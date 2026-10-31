import {describe,expect,it} from "vitest";
import {loadConfig} from "../src/config.js";

const defaults:NodeJS.ProcessEnv={
  DATABASE_URL:"postgresql://family_runtime:example@localhost:5432/family_os",
  OIDC_ISSUER:"https://identity.example.test/realm",
  OIDC_AUDIENCE:"family-os-api",
  OIDC_JWKS_URI:"https://identity.example.test/realm/keys",
  NODE_ENV:"development",
  APP_ALLOWED_ORIGINS:"http://localhost:5173"
};
describe("B0 fail-closed configuration",()=>{
  it("requires a trusted issuer, audience, signing keys and database credentials",()=>{
    const missing={...defaults,OIDC_ISSUER:undefined};
    expect(()=>loadConfig(missing)).toThrow(/OIDC_ISSUER/);
    expect(()=>loadConfig({...defaults,OIDC_JWKS_URI:"not a URL"})).toThrow(/OIDC_JWKS_URI/);
    expect(()=>loadConfig({...defaults,OIDC_AUDIENCE:"x"})).toThrow(/OIDC_AUDIENCE/);
  });
  it("rejects insecure identity endpoints outside explicit test mode",()=>{
    expect(()=>loadConfig({...defaults,OIDC_ISSUER:"http://localhost:8080/realms/family"})).toThrow(/HTTPS/);
    expect(()=>loadConfig({...defaults,OIDC_JWKS_URI:"http://localhost:8080/jwks"})).toThrow(/HTTPS/);
    expect(loadConfig({...defaults,NODE_ENV:"test",OIDC_JWKS_URI:"http://127.0.0.1:8080/jwks"}).jwksUri)
      .toBe("http://127.0.0.1:8080/jwks");
  });
  it("requires actual production TLS and exact HTTPS CORS origins",()=>{
    const production={...defaults,NODE_ENV:"production",APP_ALLOWED_ORIGINS:"https://family.example.com"};
    expect(()=>loadConfig({...production,DATABASE_URL:defaults.DATABASE_URL})).toThrow(/TLS/);
    expect(()=>loadConfig({...production,DATABASE_URL:defaults.DATABASE_URL+"?sslmode=disable"})).toThrow(/TLS/);
    expect(loadConfig({...production,DATABASE_URL:defaults.DATABASE_URL+"?sslmode=verify-full"}).production).toBe(true);
    expect(()=>loadConfig({...production,APP_ALLOWED_ORIGINS:"*",
      DATABASE_URL:defaults.DATABASE_URL+"?sslmode=require"})).toThrow(/origins/);
    expect(()=>loadConfig({...production,APP_ALLOWED_ORIGINS:"http://localhost:5173",
      DATABASE_URL:defaults.DATABASE_URL+"?sslmode=require"})).toThrow(/origins/);
  });
});
