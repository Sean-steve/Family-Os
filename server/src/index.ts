import {loadConfig} from "./config.js";
import {createRuntimePool} from "./database.js";
import {createApi} from "./app.js";

async function main(){
  const config=loadConfig();
  const pool=createRuntimePool(config.databaseUrl);
  try{
    const app=await createApi({pool,oidc:{issuer:config.issuer,audience:config.audience,
      jwksUri:config.jwksUri},allowedOrigins:config.allowedOrigins,
      logger:config.production});
    for(const signal of ["SIGTERM","SIGINT"] as const)process.once(signal,()=>{
      void app.close().then(()=>pool.end()).finally(()=>process.exit(0));
    });
    await app.listen({host:config.host,port:config.port});
  }catch(error){await pool.end();throw error;}
}
main().catch(error=>{
  // Never print configuration values, database URLs or access tokens.
  process.stderr.write("Family OS API could not start ("+(error instanceof Error?error.name:"error")+").\n");
  process.exitCode=1;
});
