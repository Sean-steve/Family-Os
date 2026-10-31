import {createHash} from "node:crypto";
import {readdir,readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {join} from "node:path";
import {Pool} from "pg";
const directory=fileURLToPath(new URL("../migrations/",import.meta.url));
export async function migrate(adminUrl:string,runtimeUrl:string):Promise<void>{
  const runtime=new URL(runtimeUrl);
  if(decodeURIComponent(runtime.username)!=="family_runtime"||!runtime.password)
    throw new Error("DATABASE_URL must use family_runtime with a nonempty password.");
  const admin=new Pool({connectionString:adminUrl,max:1});const db=await admin.connect();
  try{
    const role=await db.query("SELECT 1 FROM pg_roles WHERE rolname='family_runtime'");
    if(role.rowCount===0){
      const format=await db.query<{statement:string}>(
        "SELECT format('CREATE ROLE family_runtime LOGIN PASSWORD %L', $1) AS statement",
        [decodeURIComponent(runtime.password)]);
      await db.query(format.rows[0].statement);
    }
    await db.query("BEGIN");
    await db.query("SELECT pg_advisory_xact_lock(2026,8000)");
    await db.query("CREATE SCHEMA IF NOT EXISTS family");
    await db.query("CREATE TABLE IF NOT EXISTS family.schema_migrations ("+
      "version text PRIMARY KEY, checksum_sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())");
    const versions=(await readdir(directory)).filter(f=>/^[0-9]{4}_[a-z0-9_]+\.sql$/.test(f)).sort();
    if(!versions.length)throw new Error("No migrations found.");
    for(const filename of versions){
      const version=filename.slice(0,-4);
      const sql=await readFile(join(directory,filename),"utf8");
      const checksum=createHash("sha256").update(sql).digest("hex");
      const existing=await db.query<{checksum_sha256:string}>(
        "SELECT checksum_sha256 FROM family.schema_migrations WHERE version=$1",[version]);
      if(existing.rowCount){
        if(existing.rows[0].checksum_sha256!==checksum)throw new Error("Previously applied migration changed: "+version);
        continue;
      }
      await db.query(sql);
      await db.query("INSERT INTO family.schema_migrations(version,checksum_sha256) VALUES($1,$2)",[version,checksum]);
    }
    await db.query("COMMIT");
  }catch(error){try{await db.query("ROLLBACK");}catch{/* preserve original error */}throw error;}
  finally{db.release();await admin.end();}
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  const admin=process.env.DATABASE_ADMIN_URL,runtime=process.env.DATABASE_URL;
  if(!admin||!runtime)throw new Error("DATABASE_ADMIN_URL and DATABASE_URL required.");
  migrate(admin,runtime).then(()=>process.stdout.write("Family OS migrations verified.\n"))
    .catch(error=>{process.stderr.write("Migration failed: "+String(error)+"\n");process.exitCode=1;});
}
