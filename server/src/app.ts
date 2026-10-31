import Fastify,{type FastifyInstance} from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import {z} from "zod";
import type {Pool} from "pg";
import {createOidcVerifier,InvalidAuthentication,type OidcConfig,type Principal} from "./auth.js";
import {withActor} from "./database.js";

export type ApiOptions={pool:Pool;oidc:OidcConfig;allowedOrigins?:string[];logger?:boolean};
declare module "fastify" {interface FastifyRequest{familyPrincipal?:Principal;}}
const CreateFamily=z.object({name:z.string().trim().min(2).max(120)}).strict();
const FamilyId=z.object({familyId:z.string().uuid()});
type FamilyRow={id:string;name:string;role:string;created_at:Date};
const jsonError=(code:string,message:string)=>({error:{code,message}});
const presentFamily=(r:FamilyRow)=>({id:r.id,name:r.name,role:r.role,createdAt:r.created_at.toISOString()});

export async function createApi(options:ApiOptions):Promise<FastifyInstance>{
  const app=Fastify({logger:options.logger===true?{
    redact:["req.headers.authorization","req.headers.cookie","res.headers.set-cookie"]
  }:false,bodyLimit:32768,trustProxy:false});
  const verify=createOidcVerifier(options.oidc);
  await app.register(cors,{origin:options.allowedOrigins?.length?options.allowedOrigins:false,
    credentials:false,methods:["GET","POST","OPTIONS"],allowedHeaders:["Authorization","Content-Type"]});
  await app.register(rateLimit,{max:90,timeWindow:"1 minute"});
  app.addHook("onSend",async(_request,reply,payload)=>{
    reply.header("Cache-Control","no-store");
    reply.header("X-Content-Type-Options","nosniff");
    reply.header("Referrer-Policy","no-referrer");
    return payload;
  });
  app.setErrorHandler((_error,request,reply)=>{
    // No PostgreSQL errors, SQL, token hints, identity claims or stack traces.
    request.log.error({code:"UNEXPECTED_API_ERROR"},"API request failed");
    reply.code(500).send(jsonError("INTERNAL_ERROR","Unable to complete request."));
  });
  app.get("/health/live",async()=>({status:"ok",service:"family-os-api"}));
  app.get("/health/ready",async(_request,reply)=>{
    try{await options.pool.query("SELECT 1");return {status:"ready"};}
    catch{return reply.code(503).send({status:"not_ready"});}
  });
  await app.register(async scoped=>{
    scoped.addHook("onRequest",async(request,reply)=>{
      try{request.familyPrincipal=await verify(request.headers.authorization);}
      catch(error){
        if(!(error instanceof InvalidAuthentication))
          request.log.warn({code:"AUTH_UNKNOWN_FAILURE"},"Authentication failed");
        return reply.code(401).send(jsonError("UNAUTHORIZED","Valid access token required."));
      }
    });
    scoped.get("/api/v1/me",async(request)=>{
      const principal=request.familyPrincipal!;
      return withActor(options.pool,principal,async db=>{
        const count=await db.query<{total:string}>(
          "SELECT count(*)::text AS total FROM family.memberships "+
          "WHERE user_id=$1 AND state='ACTIVE'",[principal.actorId]);
        return {data:{id:principal.actorId,authority:"OIDC",familyCount:Number(count.rows[0].total)}};
      });
    });
    scoped.post("/api/v1/families",async(request,reply)=>{
      const body=CreateFamily.safeParse(request.body);
      if(!body.success)return reply.code(400).send(jsonError("VALIDATION_ERROR","Expected a family name of 2–120 characters."));
      const principal=request.familyPrincipal!;
      const family=await withActor(options.pool,principal,async db=>{
        const inserted=await db.query<FamilyRow>(
          "INSERT INTO family.families(name,created_by) VALUES($1,$2) "+
          "RETURNING id,name,created_at,'OWNER'::text AS role",
          [body.data.name,principal.actorId]);
        const row=inserted.rows[0];
        await db.query("INSERT INTO family.memberships(family_id,user_id,role) VALUES($1,$2,'OWNER')",
          [row.id,principal.actorId]);
        await db.query("INSERT INTO family.audit_events(family_id,actor_user_id,action,object_type,object_id) "+
          "VALUES($1,$2,'FAMILY_CREATED','FAMILY',$1)",[row.id,principal.actorId]);
        await db.query("INSERT INTO family.outbox(family_id,event_type,aggregate_id,payload) "+
          "VALUES($1,'family.created.v1',$1,jsonb_build_object('familyId',($1::uuid)::text,'createdBy',($2::uuid)::text))",
          [row.id,principal.actorId]);
        return presentFamily(row);
      });
      return reply.code(201).header("Location","/api/v1/families/"+family.id).send({data:family});
    });
    scoped.get("/api/v1/families",async(request)=>{
      const principal=request.familyPrincipal!;
      return withActor(options.pool,principal,async db=>{
        const result=await db.query<FamilyRow>(
          "SELECT f.id,f.name,f.created_at,m.role FROM family.families f "+
          "INNER JOIN family.memberships m ON m.family_id=f.id "+
          "WHERE m.user_id=$1 AND m.state='ACTIVE' ORDER BY f.created_at DESC,f.id LIMIT 50",
          [principal.actorId]);
        return {data:{items:result.rows.map(presentFamily),count:result.rows.length,hasMore:result.rows.length===50}};
      });
    });
    scoped.get<{Params:{familyId:string}}>("/api/v1/families/:familyId",async(request,reply)=>{
      const parsed=FamilyId.safeParse(request.params);
      if(!parsed.success)return reply.code(400).send(jsonError("VALIDATION_ERROR","Invalid family ID."));
      const principal=request.familyPrincipal!;
      const row=await withActor(options.pool,principal,async db=>{
        const result=await db.query<FamilyRow>(
          "SELECT f.id,f.name,f.created_at,m.role FROM family.families f "+
          "JOIN family.memberships m ON m.family_id=f.id "+
          "WHERE f.id=$1 AND m.user_id=$2 AND m.state='ACTIVE' LIMIT 1",
          [parsed.data.familyId,principal.actorId]);
        return result.rows[0]||null;
      });
      if(!row)return reply.code(404).send(jsonError("NOT_FOUND","Family not found."));
      return {data:presentFamily(row)};
    });
  });
  await app.ready();
  return app;
}
