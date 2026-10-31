#!/usr/bin/env node
// Staging preflight; prints field names only, NEVER sensitive values.
import {readFileSync} from "node:fs";
const file=process.argv[2]||"infra/staging/.env.example";
const template=process.argv.includes("--template");
const text=readFileSync(file,"utf8");
const env=Object.fromEntries(text.split(/\r?\n/).filter(x=>/^[A-Z_][A-Z0-9_]*=/.test(x))
  .map(line=>{const p=line.indexOf("=");return [line.slice(0,p),line.slice(p+1).trim()];}));
const required=["FAMILY_API_DOMAIN","FAMILY_IDENTITY_DOMAIN","FAMILY_WEB_ORIGIN","FAMILY_ACME_EMAIL",
  "FAMILY_ADMIN_ALLOW_CIDR","FAMILY_DATABASE_URL","FAMILY_DATABASE_ADMIN_URL",
  "FAMILY_IDENTITY_JDBC_URL","FAMILY_IDENTITY_DB_USER","FAMILY_IDENTITY_DB_PASSWORD",
  "FAMILY_IDENTITY_ADMIN_USER","FAMILY_IDENTITY_ADMIN_PASSWORD"];
const failures=[];
for(const name of required)if(!env[name])failures.push("Missing "+name);
const expect=(name,condition)=>{if(!condition)failures.push("Invalid or insecure "+name);};
const validHost=v=>/^(?!-)[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(v||"");
expect("FAMILY_API_DOMAIN",validHost(env.FAMILY_API_DOMAIN));
expect("FAMILY_IDENTITY_DOMAIN",validHost(env.FAMILY_IDENTITY_DOMAIN));
expect("distinct hostnames",env.FAMILY_API_DOMAIN!==env.FAMILY_IDENTITY_DOMAIN);
try{
  const web=new URL(env.FAMILY_WEB_ORIGIN);
  expect("FAMILY_WEB_ORIGIN",web.protocol==="https:"&&web.origin===env.FAMILY_WEB_ORIGIN);
}catch{failures.push("Invalid FAMILY_WEB_ORIGIN");}
expect("FAMILY_ACME_EMAIL",/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(env.FAMILY_ACME_EMAIL||""));
expect("FAMILY_ADMIN_ALLOW_CIDR",/^(?:[0-9.]+\/(?:[0-9]|[12][0-9]|3[0-2])|[0-9a-fA-F:]+\/\d{1,3})$/.test(env.FAMILY_ADMIN_ALLOW_CIDR||""));
if(!template){
  for(const name of required)expect(name,Boolean(env[name])&&!/REPLACE|CHANGEME|example\.invalid|\.example\./i.test(env[name]));
  try{
    const db=new URL(env.FAMILY_DATABASE_URL),admin=new URL(env.FAMILY_DATABASE_ADMIN_URL);
    expect("DATABASE_URL TLS/role",db.protocol==="postgresql:"&&decodeURIComponent(db.username)==="family_runtime"&&db.password.length>=16&&db.searchParams.get("sslmode")==="verify-full");
    expect("DATABASE_ADMIN_URL TLS/role",admin.protocol==="postgresql:"&&decodeURIComponent(admin.username)!=="family_runtime"&&admin.password.length>=16&&admin.searchParams.get("sslmode")==="verify-full");
    expect("database scope",db.hostname===admin.hostname&&db.pathname===admin.pathname);
  }catch{failures.push("Invalid PostgreSQL URL");}
  expect("Keycloak managed JDBC TLS",/^jdbc:postgresql:\/\/[^?#]+[?&]sslmode=(verify-full|require)(?:&|$)/.test(env.FAMILY_IDENTITY_JDBC_URL||""));
  expect("Keycloak bootstrap password",String(env.FAMILY_IDENTITY_ADMIN_PASSWORD||"").length>=24);
  expect("Keycloak database password",String(env.FAMILY_IDENTITY_DB_PASSWORD||"").length>=16);
}
if(failures.length){
  process.stderr.write("Family staging preflight failed:\n"+failures.map(x=>" - "+x).join("\n")+"\n");
  process.exit(1);
}
process.stdout.write("Family staging preflight passed ("+(template?"template":"real configuration")+").\n");
