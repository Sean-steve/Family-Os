import {afterAll,beforeAll,describe,expect,it} from "vitest";
import {createServer,type Server} from "node:http";
import {AddressInfo} from "node:net";
import {randomUUID} from "node:crypto";
import {readFileSync} from "node:fs";
import {generateKeyPair,exportJWK,SignJWT} from "jose";
import {Pool} from "pg";
import {createApi} from "../src/app.js";
import {actorIdFor} from "../src/auth.js";
import {createRuntimePool,withActor} from "../src/database.js";

const issuer="https://identity.family-os.test/realm";
const audience="family-os-api";
const source=JSON.parse(readFileSync(new URL("../../contracts/openapi.json",import.meta.url),"utf8")) as {
  paths:Record<string,Record<string,unknown>>;
  components:{securitySchemes:Record<string,unknown>};
};
let server:Server;
let pool:Pool;
let admin:Pool;
let app:Awaited<ReturnType<typeof createApi>>;
let privateKey:CryptoKey;
const auth=async(subject:string)=>{
  const token=await new SignJWT({}).setProtectedHeader({alg:"RS256",kid:"family-os-ci-key"})
    .setIssuer(issuer).setAudience(audience).setSubject(subject)
    .setIssuedAt().setExpirationTime("15m").sign(privateKey);
  return {authorization:"Bearer "+token};
};
const identityA="b0-alice-"+randomUUID(),identityB="b0-bob-"+randomUUID();
beforeAll(async()=>{
  if(!process.env.DATABASE_URL||!process.env.DATABASE_ADMIN_URL)
    throw new Error("B0 integration tests require migrated PostgreSQL runtime and admin URLs.");
  const keys=await generateKeyPair("RS256",{extractable:true});
  privateKey=keys.privateKey;
  const publicJwk=await exportJWK(keys.publicKey);
  const jwk={...publicJwk,kid:"family-os-ci-key",alg:"RS256",use:"sig"};
  server=createServer((request,response)=>{
    if(request.url!=="/keys"){response.writeHead(404).end();return;}
    response.writeHead(200,{"content-type":"application/json"});
    response.end(JSON.stringify({keys:[jwk]}));
  });
  await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
  const addr=server.address() as AddressInfo;
  pool=createRuntimePool(process.env.DATABASE_URL);
  admin=new Pool({connectionString:process.env.DATABASE_ADMIN_URL});
  app=await createApi({pool,oidc:{issuer,audience,jwksUri:"http://127.0.0.1:"+addr.port+"/keys"}});
},20000);
afterAll(async()=>{
  if(app)await app.close();
  if(pool)await pool.end();
  if(admin)await admin.end();
  if(server)await new Promise<void>(resolve=>server.close(()=>resolve()));
});
describe("B0 OpenAPI and health boundaries",()=>{
  it("keeps the versioned contract explicit and forbids private domain endpoints",()=>{
    const paths=Object.keys(source.paths);
    expect(paths).toEqual(expect.arrayContaining(["/health/live","/health/ready",
      "/api/v1/me","/api/v1/families","/api/v1/families/{familyId}"]));
    expect(Object.keys(source.paths["/api/v1/families"]).sort()).toEqual(["get","post"]);
    expect(source.components.securitySchemes).toHaveProperty("OidcBearer");
    expect(paths.some(p=>/health-record|child-profil|private-memory|messages|consent-grants/.test(p))).toBe(false);
  });
  it("serves unauthenticated liveness and database readiness without leaking credentials",async()=>{
    const live=await app.inject({method:"GET",url:"/health/live"});
    const ready=await app.inject({method:"GET",url:"/health/ready"});
    expect(live.statusCode).toBe(200);
    expect(ready.statusCode).toBe(200);
    expect(JSON.stringify(live.json())+JSON.stringify(ready.json())).not.toContain("postgres");
  });
});
describe("B0 authenticated and tenant-isolated family bootstrap",()=>{
  let familyId="";
  it("fails closed without a signed audience-bound bearer token",async()=>{
    const absent=await app.inject({method:"GET",url:"/api/v1/me"});
    expect(absent.statusCode).toBe(401);
    expect(absent.json().error.code).toBe("UNAUTHORIZED");
    const malformed=await app.inject({method:"GET",url:"/api/v1/me",headers:{authorization:"Bearer nonsense"}});
    expect(malformed.statusCode).toBe(401);
    const badAudience=await new SignJWT({}).setProtectedHeader({alg:"RS256",kid:"family-os-ci-key"})
      .setIssuer(issuer).setAudience("other-service").setSubject(identityA).setIssuedAt().setExpirationTime("15m").sign(privateKey);
    expect((await app.inject({method:"GET",url:"/api/v1/me",
      headers:{authorization:"Bearer "+badAudience}})).statusCode).toBe(401);
    const expired=await new SignJWT({}).setProtectedHeader({alg:"RS256",kid:"family-os-ci-key"})
      .setIssuer(issuer).setAudience(audience).setSubject(identityA).setIssuedAt(Math.floor(Date.now()/1000)-7200)
      .setExpirationTime(Math.floor(Date.now()/1000)-3600).sign(privateKey);
    expect((await app.inject({method:"GET",url:"/api/v1/me",
      headers:{authorization:"Bearer "+expired}})).statusCode).toBe(401);
  });
  it("creates persistent actor only from signed issuer/sub and stores no display name",async()=>{
    const result=await app.inject({method:"GET",url:"/api/v1/me",headers:await auth(identityA)});
    expect(result.statusCode).toBe(200);
    expect(result.json().data).toEqual({id:actorIdFor(issuer,identityA),
      authority:"OIDC",familyCount:0});
    expect(actorIdFor(issuer,identityA)).not.toBe(actorIdFor(issuer,identityB));
    expect(actorIdFor("https://other-issuer",identityA)).not.toBe(actorIdFor(issuer,identityA));
  });
  it("creates a family, OWNER membership, audit and outbox in a single transaction",async()=>{
    const name="Family B0 integration "+randomUUID();
    const response=await app.inject({method:"POST",url:"/api/v1/families",
      headers:await auth(identityA),payload:{name}});
    expect(response.statusCode).toBe(201);
    const data=response.json().data;
    familyId=data.id;
    expect(data.role).toBe("OWNER");
    expect(data.name).toBe(name);
    expect(response.headers.location).toBe("/api/v1/families/"+familyId);
    const membership=await admin.query("SELECT role,state FROM family.memberships WHERE family_id=$1",[familyId]);
    const audit=await admin.query("SELECT action FROM family.audit_events WHERE family_id=$1",[familyId]);
    const outbox=await admin.query("SELECT event_type FROM family.outbox WHERE family_id=$1",[familyId]);
    expect(membership.rows).toEqual([{role:"OWNER",state:"ACTIVE"}]);
    expect(audit.rows).toEqual([{action:"FAMILY_CREATED"}]);
    expect(outbox.rows).toEqual([{event_type:"family.created.v1"}]);
  });
  it("allows creator access and conceals the same family from another valid actor",async()=>{
    const mine=await app.inject({method:"GET",url:"/api/v1/families",headers:await auth(identityA)});
    expect(mine.statusCode).toBe(200);
    expect(mine.json().data.items.some((f:{id:string})=>f.id===familyId)).toBe(true);
    const other=await app.inject({method:"GET",url:"/api/v1/families",headers:await auth(identityB)});
    expect(other.statusCode).toBe(200);
    expect(other.json().data.items).toEqual([]);
    const forbidden=await app.inject({method:"GET",url:"/api/v1/families/"+familyId,headers:await auth(identityB)});
    expect(forbidden.statusCode).toBe(404);
    const allowed=await app.inject({method:"GET",url:"/api/v1/families/"+familyId,headers:await auth(identityA)});
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json().data.id).toBe(familyId);
  });
  it("enforces RLS under runtime credentials even for direct parameterized queries",async()=>{
    const role=await pool.query("SELECT rolbypassrls,rolsuper FROM pg_roles WHERE rolname=current_user");
    expect(role.rows[0]).toEqual({rolbypassrls:false,rolsuper:false});
    const anonymous=await pool.query("SELECT id FROM family.families WHERE id=$1",[familyId]);
    expect(anonymous.rows).toEqual([]);
    const other={issuer,subject:identityB,actorId:actorIdFor(issuer,identityB)};
    const visible=await withActor(pool,other,async db=>
      (await db.query("SELECT id FROM family.families WHERE id=$1",[familyId])).rows);
    expect(visible).toEqual([]);
    await expect(pool.query("SELECT * FROM family.consent_grants")).rejects.toThrow();
    const unauthenticatedUpdate=await pool.query("UPDATE family.families SET name='bypassed' WHERE id=$1",[familyId]);
    expect(unauthenticatedUpdate.rowCount).toBe(0);
    const persisted=await admin.query("SELECT name FROM family.families WHERE id=$1",[familyId]);
    expect(persisted.rows[0].name).not.toBe("bypassed");
    const controls=await admin.query("SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class "+
      "WHERE relnamespace='family'::regnamespace AND relname IN ('families','memberships','identities','consent_grants')");
    expect(controls.rows).toHaveLength(4);
    expect(controls.rows.every(r=>r.relrowsecurity&&r.relforcerowsecurity)).toBe(true);
  });
  it("revocation blocks the original creator at the RLS layer as well as the API",async()=>{
    const changed=await admin.query(
      "UPDATE family.memberships SET state='REVOKED' WHERE family_id=$1 RETURNING state",[familyId]);
    expect(changed.rows).toEqual([{state:"REVOKED"}]);
    const former={issuer,subject:identityA,actorId:actorIdFor(issuer,identityA)};
    const rows=await withActor(pool,former,async db=>
      (await db.query("SELECT id FROM family.families WHERE id=$1",[familyId])).rows);
    expect(rows).toEqual([]);
    const response=await app.inject({method:"GET",url:"/api/v1/families/"+familyId,
      headers:await auth(identityA)});
    expect(response.statusCode).toBe(404);
  });
  it("rejects invalid or extra client fields and never trusts a caller-supplied role",async()=>{
    const attempt=await app.inject({method:"POST",url:"/api/v1/families",headers:await auth(identityB),
      payload:{name:"Illegal override",role:"OWNER",created_by:actorIdFor(issuer,identityA)}});
    expect(attempt.statusCode).toBe(400);
    const empty=await app.inject({method:"POST",url:"/api/v1/families",headers:await auth(identityB),
      payload:{name:"x"}});
    expect(empty.statusCode).toBe(400);
    const noFamily=await app.inject({method:"GET",url:"/api/v1/families/not-a-uuid",headers:await auth(identityB)});
    expect(noFamily.statusCode).toBe(400);
  });
});
