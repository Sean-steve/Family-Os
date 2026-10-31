import {createHash,randomBytes,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import type {FastifyInstance} from "fastify";
import {z} from "zod";
import {withActor} from "./database.js";
import type {Principal} from "./auth.js";

type Outcome={status:number;body:unknown};
type Role="OWNER"|"CO_PARENT"|"ADULT"|"TEEN"|"CHILD"|"GUEST";
type HouseholdRecord={
  id:string;family_id:string;name:string;kind:string;archived_at:Date|null;created_at:Date;updated_at:Date;
};
type MemberRecord={user_id:string;role:Role;state:string;joined_at:Date};
const uuid=z.string().uuid();
const FId=z.object({familyId:uuid});
const HId=FId.extend({householdId:uuid});
const MId=FId.extend({userId:uuid});
const inviteParams=z.object({invitationId:uuid});
const householdInput=z.object({
  name:z.string().trim().min(2).max(120),
  kind:z.enum(["PRIMARY_HOME","SECONDARY_HOME","SHARED_HOME","OTHER"]).default("OTHER")
}).strict();
const householdPatch=z.object({
  name:z.string().trim().min(2).max(120).optional(),
  kind:z.enum(["PRIMARY_HOME","SECONDARY_HOME","SHARED_HOME","OTHER"]).optional()
}).strict().refine(x=>x.name!==undefined||x.kind!==undefined);
const inviteInput=z.object({targetUserId:uuid,role:z.enum(["ADULT","GUEST"])}).strict();
const acceptInput=z.object({code:z.string().regex(/^[0-9a-f]{64}$/)}).strict();
const roleInput=z.object({role:z.enum(["ADULT","GUEST"])}).strict();
const failed=(status:number,code:string,message:string):Outcome=>({status,body:{error:{code,message}}});
const ok=(data:unknown,status=200):Outcome=>({status,body:{data}});
const invalid=()=>failed(400,"VALIDATION_ERROR","Invalid request.");
const missing=()=>failed(404,"NOT_FOUND","Resource not found.");
const denied=()=>failed(403,"FORBIDDEN","This action is not permitted for your verified family membership.");
const presenter=(row:HouseholdRecord)=>({
  id:row.id,familyId:row.family_id,name:row.name,kind:row.kind,
  archivedAt:row.archived_at?.toISOString()||null,
  createdAt:row.created_at.toISOString(),updatedAt:row.updated_at.toISOString()
});
const presentMember=(row:MemberRecord)=>({
  userId:row.user_id,role:row.role,state:row.state,joinedAt:row.joined_at.toISOString()
});
const pgCode=(error:unknown)=>typeof error==="object"&&error!==null&&"code" in error?
  String((error as {code:unknown}).code):"";
async function roleFor(db:PoolClient,familyId:string):Promise<Role|null>{
  const result=await db.query<{role:Role|null}>("SELECT family.active_role($1::uuid) AS role",[familyId]);
  return result.rows[0]?.role||null;
}
function authorize(role:Role|null,allowed:Role[]):Outcome|null{
  if(!role)return missing();
  if(!allowed.includes(role))return denied();
  return null;
}
async function mutationEvent(db:PoolClient,principal:Principal,familyId:string,
  action:string,objectType:string,objectId:string,eventType:string){
  // Events contain only object identifiers and operation names, never codes,
  // sensitive family profiles, notes, location addresses, or private OS data.
  await db.query(
    "INSERT INTO family.audit_events(family_id,actor_user_id,action,object_type,object_id) "+
    "VALUES($1::uuid,$2::uuid,$3,$4,$5::uuid)",
    [familyId,principal.actorId,action,objectType,objectId]);
  await db.query(
    "INSERT INTO family.outbox(family_id,event_type,aggregate_id,payload) "+
    "VALUES($1::uuid,$2,$3::uuid,$4::jsonb)",
    [familyId,eventType,objectId,JSON.stringify({familyId,objectId,actorId:principal.actorId})]);
}

export async function registerRegistryRoutes(app:FastifyInstance,pool:Pool):Promise<void>{
  const transaction=(principal:Principal,fn:(db:PoolClient)=>Promise<Outcome>)=>withActor(pool,principal,fn);
  app.get<{Params:{familyId:string}}>("/api/v1/families/:familyId/households",async(request,reply)=>{
    const params=FId.safeParse(request.params);if(!params.success)return reply.code(400).send(invalid().body);
    const result=await transaction(request.familyPrincipal!,async db=>{
      const guard=authorize(await roleFor(db,params.data.familyId),["OWNER","CO_PARENT","ADULT"]);
      if(guard)return guard;
      const rows=await db.query<HouseholdRecord>(
        "SELECT id,family_id,name,kind,archived_at,created_at,updated_at "+
        "FROM family.households WHERE family_id=$1 AND archived_at IS NULL "+
        "ORDER BY created_at DESC,id LIMIT 101",[params.data.familyId]);
      return ok({items:rows.rows.slice(0,100).map(presenter),hasMore:rows.rowCount!==null&&rows.rowCount>100});
    });
    return reply.code(result.status).send(result.body);
  });

  app.post<{Params:{familyId:string}}>("/api/v1/families/:familyId/households",async(request,reply)=>{
    const params=FId.safeParse(request.params),body=householdInput.safeParse(request.body);
    if(!params.success||!body.success)return reply.code(400).send(invalid().body);
    const principal=request.familyPrincipal!;
    let result:Outcome;
    try{result=await transaction(principal,async db=>{
      const guard=authorize(await roleFor(db,params.data.familyId),["OWNER","CO_PARENT"]);
      if(guard)return guard;
      const insert=await db.query<HouseholdRecord>(
        "INSERT INTO family.households(family_id,name,kind,created_by) "+
        "VALUES($1::uuid,$2,$3,$4::uuid) "+
        "RETURNING id,family_id,name,kind,archived_at,created_at,updated_at",
        [params.data.familyId,body.data.name,body.data.kind,principal.actorId]);
      const row=insert.rows[0];
      await mutationEvent(db,principal,params.data.familyId,"HOUSEHOLD_CREATED","HOUSEHOLD",row.id,
        "family.household.created.v1");
      return ok(presenter(row),201);
    });}catch(error){
      if(pgCode(error)==="23505")return reply.code(409).send(failed(409,"CONFLICT","An active primary household already exists.").body);
      throw error;
    }
    return reply.code(result.status).send(result.body);
  });

  app.patch<{Params:{familyId:string;householdId:string}}>(
    "/api/v1/families/:familyId/households/:householdId",async(request,reply)=>{
    const params=HId.safeParse(request.params),body=householdPatch.safeParse(request.body);
    if(!params.success||!body.success)return reply.code(400).send(invalid().body);
    const principal=request.familyPrincipal!;
    let result:Outcome;
    try{result=await transaction(principal,async db=>{
      const guard=authorize(await roleFor(db,params.data.familyId),["OWNER","CO_PARENT"]);
      if(guard)return guard;
      const updated=await db.query<HouseholdRecord>(
        "UPDATE family.households SET name=COALESCE($3,name),kind=COALESCE($4,kind),updated_at=now() "+
        "WHERE family_id=$1::uuid AND id=$2::uuid AND archived_at IS NULL "+
        "RETURNING id,family_id,name,kind,archived_at,created_at,updated_at",
        [params.data.familyId,params.data.householdId,body.data.name||null,body.data.kind||null]);
      if(!updated.rowCount)return missing();
      await mutationEvent(db,principal,params.data.familyId,"HOUSEHOLD_UPDATED","HOUSEHOLD",
        params.data.householdId,"family.household.updated.v1");
      return ok(presenter(updated.rows[0]));
    });}catch(error){
      if(pgCode(error)==="23505")return reply.code(409).send(failed(409,"CONFLICT","An active primary household already exists.").body);
      throw error;
    }
    return reply.code(result.status).send(result.body);
  });

  app.delete<{Params:{familyId:string;householdId:string}}>(
    "/api/v1/families/:familyId/households/:householdId",async(request,reply)=>{
    const params=HId.safeParse(request.params);if(!params.success)return reply.code(400).send(invalid().body);
    const principal=request.familyPrincipal!;
    const result=await transaction(principal,async db=>{
      const guard=authorize(await roleFor(db,params.data.familyId),["OWNER","CO_PARENT"]);
      if(guard)return guard;
      const archived=await db.query(
        "UPDATE family.households SET archived_at=now(),updated_at=now() "+
        "WHERE family_id=$1::uuid AND id=$2::uuid AND archived_at IS NULL RETURNING id",
        [params.data.familyId,params.data.householdId]);
      if(!archived.rowCount)return missing();
      await mutationEvent(db,principal,params.data.familyId,"HOUSEHOLD_ARCHIVED","HOUSEHOLD",
        params.data.householdId,"family.household.archived.v1");
      return {status:204,body:null};
    });
    return reply.code(result.status).send(result.body);
  });

  app.get<{Params:{familyId:string}}>("/api/v1/families/:familyId/memberships",async(request,reply)=>{
    const params=FId.safeParse(request.params);if(!params.success)return reply.code(400).send(invalid().body);
    const result=await transaction(request.familyPrincipal!,async db=>{
      const guard=authorize(await roleFor(db,params.data.familyId),["OWNER"]);
      if(guard)return guard;
      const rows=await db.query<MemberRecord>(
        "SELECT user_id,role,state,joined_at FROM family.memberships "+
        "WHERE family_id=$1::uuid AND state='ACTIVE' AND role IN('OWNER','CO_PARENT','ADULT','GUEST') "+
        "ORDER BY joined_at,user_id LIMIT 101",[params.data.familyId]);
      return ok({items:rows.rows.slice(0,100).map(presentMember),hasMore:rows.rows.length>100});
    });
    return reply.code(result.status).send(result.body);
  });

  app.post<{Params:{familyId:string}}>("/api/v1/families/:familyId/invitations",async(request,reply)=>{
    const params=FId.safeParse(request.params),body=inviteInput.safeParse(request.body);
    if(!params.success||!body.success)return reply.code(400).send(invalid().body);
    const principal=request.familyPrincipal!;
    const invitationId=randomUUID(),code=randomBytes(32).toString("hex");
    const sha256=createHash("sha256").update(Buffer.from(code,"hex")).digest("hex");
    const expiresAt=new Date(Date.now()+48*60*60*1000);
    let result:Outcome;
    try{result=await transaction(principal,async db=>{
      const guard=authorize(await roleFor(db,params.data.familyId),["OWNER"]);
      if(guard)return guard;
      if(body.data.targetUserId===principal.actorId)return failed(422,"INVALID_TARGET","Cannot invite yourself.");
      const existing=await db.query("SELECT 1 FROM family.memberships WHERE family_id=$1::uuid "+
        "AND user_id=$2::uuid AND state='ACTIVE'",
        [params.data.familyId,body.data.targetUserId]);
      if(existing.rowCount)return failed(409,"CONFLICT","This subject already belongs to the family.");
      await db.query(
        "INSERT INTO family.invitations(id,family_id,target_user_id,role,secret_sha256,issued_by,expires_at) "+
        "VALUES($1::uuid,$2::uuid,$3::uuid,$4,$5,$6::uuid,$7::timestamptz)",
        [invitationId,params.data.familyId,body.data.targetUserId,body.data.role,sha256,principal.actorId,expiresAt]);
      await mutationEvent(db,principal,params.data.familyId,"INVITATION_ISSUED","INVITATION",
        invitationId,"family.invitation.issued.v1");
      return ok({id:invitationId,targetUserId:body.data.targetUserId,role:body.data.role,
        expiresAt:expiresAt.toISOString(),code},201);
    });}catch(error){
      if(pgCode(error)==="23503")return reply.code(422).send(failed(422,"INVALID_TARGET",
        "Recipient must first sign in through the trusted identity provider.").body);
      throw error;
    }
    return reply.code(result.status).send(result.body);
  });

  app.post<{Params:{invitationId:string}}>("/api/v1/invitations/:invitationId/accept",async(request,reply)=>{
    const params=inviteParams.safeParse(request.params),body=acceptInput.safeParse(request.body);
    if(!params.success||!body.success)return reply.code(400).send(invalid().body);
    const principal=request.familyPrincipal!;
    const sha256=createHash("sha256").update(Buffer.from(body.data.code,"hex")).digest("hex");
    const result=await transaction(principal,async db=>{
      const accepted=await db.query<{accepted_family_id:string;accepted_role:string}>(
        "SELECT accepted_family_id,accepted_role FROM family.accept_invitation($1::uuid,$2::text)",
        [params.data.invitationId,sha256]);
      if(!accepted.rowCount)return missing();
      const familyId=accepted.rows[0].accepted_family_id;
      await mutationEvent(db,principal,familyId,"INVITATION_ACCEPTED","INVITATION",
        params.data.invitationId,"family.invitation.accepted.v1");
      return ok({familyId,role:accepted.rows[0].accepted_role});
    });
    return reply.code(result.status).send(result.body);
  });

  app.patch<{Params:{familyId:string;userId:string}}>(
    "/api/v1/families/:familyId/memberships/:userId",async(request,reply)=>{
    const params=MId.safeParse(request.params),body=roleInput.safeParse(request.body);
    if(!params.success||!body.success)return reply.code(400).send(invalid().body);
    const principal=request.familyPrincipal!;
    const result=await transaction(principal,async db=>{
      const guard=authorize(await roleFor(db,params.data.familyId),["OWNER"]);
      if(guard)return guard;
      const row=await db.query<MemberRecord>(
        "UPDATE family.memberships SET role=$3 "+
        "WHERE family_id=$1::uuid AND user_id=$2::uuid AND role IN ('ADULT','GUEST') AND state='ACTIVE' "+
        "RETURNING user_id,role,state,joined_at",
        [params.data.familyId,params.data.userId,body.data.role]);
      if(!row.rowCount)return missing();
      await mutationEvent(db,principal,params.data.familyId,"MEMBERSHIP_ROLE_CHANGED","MEMBERSHIP",
        params.data.userId,"family.membership.role_changed.v1");
      return ok(presentMember(row.rows[0]));
    });
    return reply.code(result.status).send(result.body);
  });

  app.delete<{Params:{familyId:string;userId:string}}>(
    "/api/v1/families/:familyId/memberships/:userId",async(request,reply)=>{
    const params=MId.safeParse(request.params);if(!params.success)return reply.code(400).send(invalid().body);
    const principal=request.familyPrincipal!;
    const result=await transaction(principal,async db=>{
      const guard=authorize(await roleFor(db,params.data.familyId),["OWNER"]);
      if(guard)return guard;
      const revoked=await db.query(
        "UPDATE family.memberships SET state='REVOKED' "+
        "WHERE family_id=$1::uuid AND user_id=$2::uuid AND role IN ('ADULT','GUEST') AND state='ACTIVE' "+
        "RETURNING user_id",[params.data.familyId,params.data.userId]);
      if(!revoked.rowCount)return missing();
      await mutationEvent(db,principal,params.data.familyId,"MEMBERSHIP_REVOKED","MEMBERSHIP",
        params.data.userId,"family.membership.revoked.v1");
      return {status:204,body:null};
    });
    return reply.code(result.status).send(result.body);
  });
}
