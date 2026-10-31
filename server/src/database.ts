import {Pool,type PoolClient} from "pg";
import type {Principal} from "./auth.js";
export function createRuntimePool(databaseUrl:string):Pool{
  const url=new URL(databaseUrl);
  if(decodeURIComponent(url.username)!=="family_runtime")throw new Error("API must use the unprivileged family_runtime PostgreSQL role.");
  return new Pool({connectionString:databaseUrl,max:12,connectionTimeoutMillis:5000,idleTimeoutMillis:30000,
    application_name:"family-os-api"});
}
export async function withActor<T>(pool:Pool,principal:Principal,callback:(db:PoolClient)=>Promise<T>):Promise<T>{
  const db=await pool.connect();
  try{
    await db.query("BEGIN");
    await db.query("SELECT set_config('family.actor_id',$1,true)",[principal.actorId]);
    await db.query("SELECT set_config('statement_timeout','5000',true)");
    await db.query("INSERT INTO family.identities(id,issuer,subject) VALUES($1,$2,$3) "+
      "ON CONFLICT(id) DO UPDATE SET last_seen_at=now()",[principal.actorId,principal.issuer,principal.subject]);
    const result=await callback(db);
    await db.query("COMMIT");return result;
  }catch(error){try{await db.query("ROLLBACK");}catch{/* preserve original error */}throw error;}
  finally{db.release();}
}
