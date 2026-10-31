import {z} from "zod";

const environment=z.object({
  DATABASE_URL:z.string().url().refine(s=>s.startsWith("postgres://")||s.startsWith("postgresql://")),
  OIDC_ISSUER:z.string().url(),
  OIDC_AUDIENCE:z.string().min(3),
  OIDC_JWKS_URI:z.string().url(),
  APP_ALLOWED_ORIGINS:z.string().default(""),
  API_HOST:z.string().default("127.0.0.1"),
  API_PORT:z.coerce.number().int().min(1).max(65535).default(3001),
  NODE_ENV:z.enum(["development","test","production"]).default("development")
});
export type ApiConfig={databaseUrl:string;issuer:string;audience:string;jwksUri:string;
  allowedOrigins:string[];host:string;port:number;production:boolean};
export function loadConfig(env:NodeJS.ProcessEnv=process.env):ApiConfig{
  const parsed=environment.safeParse(env);
  if(!parsed.success)throw new Error("Missing or invalid API configuration: "+parsed.error.issues.map(x=>x.path.join(".")).join(", "));
  const p=parsed.data;
  if(p.NODE_ENV!=="test"&&(!p.OIDC_ISSUER.startsWith("https://")||!p.OIDC_JWKS_URI.startsWith("https://"))){
    throw new Error("OIDC issuer and JWKS must use HTTPS outside tests.");
  }
  if(p.NODE_ENV==="production"&&!["require","verify-ca","verify-full"].includes(new URL(p.DATABASE_URL).searchParams.get("sslmode")||"")){
    throw new Error("Production DATABASE_URL must explicitly configure PostgreSQL TLS (sslmode).");
  }
  const allowedOrigins=p.APP_ALLOWED_ORIGINS.split(",").map(s=>s.trim()).filter(Boolean);
  if(allowedOrigins.some(o=>!/^https?:\/\/[^/]+$/.test(o)||p.NODE_ENV==="production"&&!o.startsWith("https://"))){
    throw new Error("Allowed origins must be exact HTTPS origins in production (no paths/wildcards).");
  }
  return {databaseUrl:p.DATABASE_URL,issuer:p.OIDC_ISSUER,audience:p.OIDC_AUDIENCE,
    jwksUri:p.OIDC_JWKS_URI,allowedOrigins,host:p.API_HOST,port:p.API_PORT,
    production:p.NODE_ENV==="production"};
}
