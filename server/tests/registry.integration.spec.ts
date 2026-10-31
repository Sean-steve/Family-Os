import {afterAll,beforeAll,describe,expect,it} from "vitest";
import {createServer,type Server} from "node:http";
import {type AddressInfo} from "node:net";
import {randomUUID} from "node:crypto";
import {Pool} from "pg";
import {exportJWK,generateKeyPair,SignJWT} from "jose";
import {createApi} from "../src/app.js";
import {actorIdFor} from "../src/auth.js";
import {createRuntimePool,withActor} from "../src/database.js";

const issuer="https://identity.family-os.test/realm",audience="family-os-api";
const ownerId="owner-"+randomUUID(),adultId="adult-"+randomUUID(),strangerId="stranger-"+randomUUID();
const principal=(sub:string)=>({issuer,subject:sub,actorId:actorIdFor(issuer,sub)});
let server:Server,app:Awaited<ReturnType<typeof createApi>>,pool:Pool,admin:Pool;
let key:CryptoKey,ownerFamily="",householdId="",invitationId="",inviteCode="";
const auth=async(sub:string)=>{
  const jwt=await new SignJWT({}).setProtectedHeader({alg:"RS256",kid:"b1-integration"})
    .setIssuer(issuer).setAudience(audience).setSubject(sub).setIssuedAt().setExpirationTime("12m").sign(key);
  return {authorization:"Bearer "+jwt};
};
const req=async(sub:string,method:"GET"|"POST"|"PATCH"|"DELETE",url:string,body?:unknown)=>{
  const response=await app.inject({method,url,headers:await auth(sub),
    ...(body===undefined?{}:{payload:body})} as import("light-my-request").InjectOptions);
  return response;
};

beforeAll(async()=>{
  if(!process.env.DATABASE_URL||!process.env.DATABASE_ADMIN_URL)throw new Error("B1 requires migrated PostgreSQL.");
  const keys=await generateKeyPair("RS256",{extractable:true});key=keys.privateKey;
  const jwk={...await exportJWK(keys.publicKey),kid:"b1-integration",alg:"RS256",use:"sig"};
  server=createServer((incoming,outgoing)=>{
    if(incoming.url!=="/keys"){outgoing.writeHead(404).end();return;}
    outgoing.writeHead(200,{"content-type":"application/json"}).end(JSON.stringify({keys:[jwk]}));
  });
  await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
  const port=(server.address() as AddressInfo).port;
  pool=createRuntimePool(process.env.DATABASE_URL);
  admin=new Pool({connectionString:process.env.DATABASE_ADMIN_URL});
  app=await createApi({pool,oidc:{issuer,audience,jwksUri:"http://127.0.0.1:"+port+"/keys"}});
},20000);
afterAll(async()=>{
  if(app)await app.close();
  if(pool)await pool.end();
  if(admin)await admin.end();
  if(server)await new Promise<void>(resolve=>server.close(()=>resolve()));
});

describe("B1 authenticated household and adult-only membership flows",()=>{
  it("activates identities through signed OIDC access tokens only",async()=>{
    for(const sub of [ownerId,adultId,strangerId]){
      const res=await req(sub,"GET","/api/v1/me");expect(res.statusCode).toBe(200);
      expect(res.json().data.id).toBe(actorIdFor(issuer,sub));
    }
    const res=await req(ownerId,"POST","/api/v1/families",{name:"B1 Test Family "+randomUUID()});
    expect(res.statusCode).toBe(201);ownerFamily=res.json().data.id;
  });
  it("permits only signed OWNER to rename the authoritative family aggregate",async()=>{
    const path="/api/v1/families/"+ownerFamily;
    expect((await req(strangerId,"PATCH",path,{name:"Unauthorized rename"})).statusCode).toBe(404);
    const renamed="Family Registry B1 "+randomUUID();
    const result=await req(ownerId,"PATCH",path,{name:renamed});
    expect(result.statusCode).toBe(200);
    expect(result.json().data.name).toBe(renamed);
    expect((await req(ownerId,"GET",path)).json().data.name).toBe(renamed);
    expect((await req(ownerId,"PATCH",path,{name:"x",role:"OWNER"})).statusCode).toBe(400);
    const audits=await admin.query(
      "SELECT action FROM family.audit_events WHERE family_id=$1 AND action='FAMILY_RENAMED'",
      [ownerFamily]);
    expect(audits.rows).toEqual([{action:"FAMILY_RENAMED"}]);
  });
  it("creates, reads, updates and archives household labels with audit/outbox",async()=>{
    const url="/api/v1/families/"+ownerFamily+"/households";
    expect((await req(strangerId,"GET",url)).statusCode).toBe(404);
    expect((await req(strangerId,"POST",url,{name:"Other's household",kind:"OTHER"})).statusCode).toBe(404);
    const created=await req(ownerId,"POST",url,{name:"Main family household",kind:"PRIMARY_HOME"});
    expect(created.statusCode).toBe(201);
    householdId=created.json().data.id;
    expect(created.json().data.kind).toBe("PRIMARY_HOME");
    expect((await req(ownerId,"POST",url,{name:"Another primary",kind:"PRIMARY_HOME"})).statusCode).toBe(409);
    expect((await req(ownerId,"GET",url)).json().data.items.some((h:{id:string})=>h.id===householdId)).toBe(true);
    const updated=await req(ownerId,"PATCH",url+"/"+householdId,{name:"Renamed family household"});
    expect(updated.statusCode).toBe(200);
    expect(updated.json().data.name).toBe("Renamed family household");
    const audit=await admin.query("SELECT action FROM family.audit_events WHERE object_id=$1 ORDER BY created_at",[householdId]);
    expect(audit.rows.map(r=>r.action)).toEqual(["HOUSEHOLD_CREATED","HOUSEHOLD_UPDATED"]);
    expect((await req(ownerId,"DELETE",url+"/"+householdId)).statusCode).toBe(204);
    expect((await req(ownerId,"GET",url)).json().data.items).toEqual([]);
  });
  it("rejects child enrolment, fabricated account identities and self-invitation",async()=>{
    const path="/api/v1/families/"+ownerFamily+"/invitations";
    expect((await req(ownerId,"POST",path,{targetUserId:actorIdFor(issuer,adultId),role:"CHILD"})).statusCode).toBe(400);
    expect((await req(ownerId,"POST",path,{targetUserId:actorIdFor(issuer,adultId),role:"CO_PARENT"})).statusCode).toBe(400);
    expect((await req(ownerId,"POST",path,{targetUserId:principal(ownerId).actorId,role:"ADULT"})).statusCode).toBe(422);
    expect((await req(ownerId,"POST",path,{targetUserId:randomUUID(),role:"ADULT"})).statusCode).toBe(422);
    expect((await req(strangerId,"POST",path,{targetUserId:actorIdFor(issuer,adultId),role:"ADULT"})).statusCode).toBe(404);
  });
  it("issues an expiring secret bound to the registered recipient and returns it once",async()=>{
    const path="/api/v1/families/"+ownerFamily+"/invitations";
    const issued=await req(ownerId,"POST",path,{targetUserId:actorIdFor(issuer,adultId),role:"ADULT"});
    expect(issued.statusCode).toBe(201);
    invitationId=issued.json().data.id;inviteCode=issued.json().data.code;
    expect(inviteCode).toMatch(/^[0-9a-f]{64}$/);
    const persisted=await admin.query("SELECT secret_sha256,role,expires_at FROM family.invitations WHERE id=$1",[invitationId]);
    expect(persisted.rows[0].role).toBe("ADULT");
    expect(persisted.rows[0].secret_sha256.trim()).not.toBe(inviteCode);
    expect(persisted.rows[0].expires_at).toBeInstanceOf(Date);
    await expect(pool.query("SELECT * FROM family.invitations")).rejects.toThrow();
  });
  it("denies redemption to any other signed principal or wrong secret; accepts only intended actor",async()=>{
    const path="/api/v1/invitations/"+invitationId+"/accept";
    expect((await req(strangerId,"POST",path,{code:inviteCode})).statusCode).toBe(404);
    expect((await req(adultId,"POST",path,{code:"0".repeat(64)})).statusCode).toBe(404);
    const accepted=await req(adultId,"POST",path,{code:inviteCode});
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json().data).toEqual({familyId:ownerFamily,role:"ADULT"});
    expect((await req(adultId,"POST",path,{code:inviteCode})).statusCode).toBe(404);
    const familyList=await req(adultId,"GET","/api/v1/families");
    expect(familyList.statusCode).toBe(200);
    expect(familyList.json().data.items.some((x:{id:string})=>x.id===ownerFamily)).toBe(true);
  });
  it("allows an adult to view household labels but forbids edits and roster access",async()=>{
    const url="/api/v1/families/"+ownerFamily;
    expect((await req(adultId,"GET",url+"/households")).statusCode).toBe(200);
    expect((await req(adultId,"POST",url+"/households",{name:"Not mine",kind:"OTHER"})).statusCode).toBe(403);
    expect((await req(adultId,"GET",url+"/memberships")).statusCode).toBe(403);
    expect((await req(adultId,"POST",url+"/invitations",
      {targetUserId:principal(strangerId).actorId,role:"ADULT"})).statusCode).toBe(403);
    const roster=await req(ownerId,"GET",url+"/memberships");
    expect(roster.statusCode).toBe(200);
    expect(roster.json().data.items.map((x:{userId:string})=>x.userId).sort()).toEqual(
      [principal(ownerId).actorId,principal(adultId).actorId].sort());
    expect(JSON.stringify(roster.json())).not.toContain(adultId);
  });
  it("enforces limited role changes: owner cannot be demoted or removed via this API",async()=>{
    const url="/api/v1/families/"+ownerFamily+"/memberships/";
    const actor=principal(adultId).actorId;
    expect((await req(adultId,"PATCH",url+actor,{role:"GUEST"})).statusCode).toBe(403);
    expect((await req(ownerId,"PATCH",url+principal(ownerId).actorId,{role:"GUEST"})).statusCode).toBe(404);
    expect((await req(ownerId,"DELETE",url+principal(ownerId).actorId)).statusCode).toBe(404);
    expect((await req(ownerId,"PATCH",url+actor,{role:"OWNER"})).statusCode).toBe(400);
    const changed=await req(ownerId,"PATCH",url+actor,{role:"GUEST"});
    expect(changed.statusCode).toBe(200);
    expect(changed.json().data.role).toBe("GUEST");
    expect((await req(adultId,"GET","/api/v1/families/"+ownerFamily+"/households")).statusCode).toBe(403);
    expect((await req(ownerId,"PATCH",url+actor,{role:"ADULT"})).statusCode).toBe(200);
  });
  it("prevents role privilege escalation even through direct unprivileged SQL",async()=>{
    const owner=principal(ownerId),target=principal(adultId);
    await expect(withActor(pool,owner,async db=>db.query(
      "UPDATE family.memberships SET role='OWNER' WHERE family_id=$1 AND user_id=$2",
      [ownerFamily,target.actorId]))).rejects.toThrow();
    await expect(withActor(pool,owner,async db=>db.query(
      "INSERT INTO family.memberships(family_id,user_id,role,state) "+
      "VALUES($1,$2,'CHILD','ACTIVE')",[ownerFamily,principal(strangerId).actorId]))).rejects.toThrow();
    await expect(pool.query("SELECT * FROM family.consent_grants")).rejects.toThrow();
    const flags=await admin.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class "+
      "WHERE relname='invitations' AND relnamespace='family'::regnamespace");
    expect(flags.rows[0]).toEqual({relrowsecurity:true,relforcerowsecurity:true});
  });
  it("rejects an expired invite even with the correct identity and code",async()=>{
    const issued=await req(ownerId,"POST","/api/v1/families/"+ownerFamily+"/invitations",
      {targetUserId:principal(strangerId).actorId,role:"GUEST"});
    expect(issued.statusCode).toBe(201);
    const id=issued.json().data.id,code=issued.json().data.code;
    await admin.query("UPDATE family.invitations SET created_at=now()-interval '4 days', "+
      "expires_at=now()-interval '2 days' WHERE id=$1",[id]);
    expect((await req(strangerId,"POST","/api/v1/invitations/"+id+"/accept",{code})).statusCode).toBe(404);
    const rows=await admin.query("SELECT accepted_at FROM family.invitations WHERE id=$1",[id]);
    expect(rows.rows[0].accepted_at).toBeNull();
  });
  it("revokes guest/adult membership and blocks tenant access immediately",async()=>{
    const url="/api/v1/families/"+ownerFamily+"/memberships/"+principal(adultId).actorId;
    expect((await req(ownerId,"DELETE",url)).statusCode).toBe(204);
    const after=await req(adultId,"GET","/api/v1/families/"+ownerFamily);
    expect(after.statusCode).toBe(404);
    const deniedFamily=await req(adultId,"GET","/api/v1/families/"+ownerFamily+"/households");
    expect(deniedFamily.statusCode).toBe(404);
    const audit=await admin.query(
      "SELECT action FROM family.audit_events WHERE family_id=$1 AND action IN"+
      " ('MEMBERSHIP_ROLE_CHANGED','MEMBERSHIP_REVOKED','INVITATION_ACCEPTED')",
      [ownerFamily]);
    expect(audit.rows.map(r=>r.action)).toEqual(expect.arrayContaining(
      ["MEMBERSHIP_ROLE_CHANGED","MEMBERSHIP_REVOKED","INVITATION_ACCEPTED"]));
    const outbox=await admin.query(
      "SELECT event_type FROM family.outbox WHERE family_id=$1 AND event_type LIKE 'family.%' ",
      [ownerFamily]);
    expect(outbox.rows.some(r=>r.event_type==="family.membership.revoked.v1")).toBe(true);
  });
});
