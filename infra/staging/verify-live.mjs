#!/usr/bin/env node
// Checks the REAL, publicly reachable staging provider/ingress. No account
// secrets or access tokens are sent or printed. This is not a login test.
const api=process.env.FAMILY_API_DOMAIN,identity=process.env.FAMILY_IDENTITY_DOMAIN;
const web=process.env.FAMILY_WEB_ORIGIN;
if(!api||!identity||!web)throw new Error("FAMILY_API_DOMAIN, FAMILY_IDENTITY_DOMAIN and FAMILY_WEB_ORIGIN required");
const issuer="https://"+identity+"/realms/family-os-staging";
const endpoint="https://"+api;
const must=(value,description)=>{if(!value)throw new Error("FAILED: "+description);};
const fetchSafe=async(url,init={})=>{
  const response=await fetch(url,{cache:"no-store",redirect:"error",signal:AbortSignal.timeout(12000),...init});
  return response;
};
const liveness=await fetchSafe(endpoint+"/health/live");
must(liveness.status===200,"API liveness");
must((await liveness.json()).service==="family-os-api","correct API service");
must(liveness.headers.get("strict-transport-security"),"HSTS on public API");
const readiness=await fetchSafe(endpoint+"/health/ready");
must(readiness.status===404,"database readiness must not be public");
const unauthenticated=await fetchSafe(endpoint+"/api/v1/me");
must(unauthenticated.status===401,"no-token API authorization");
must(unauthenticated.headers.get("cache-control")?.includes("no-store"),"API no-store");
const allowed=await fetchSafe(endpoint+"/api/v1/me",{method:"OPTIONS",
  headers:{Origin:web,"Access-Control-Request-Method":"GET","Access-Control-Request-Headers":"authorization"}});
must(allowed.headers.get("access-control-allow-origin")===web,"exact-origin CORS allowlist");
const cross=await fetchSafe(endpoint+"/api/v1/me",{method:"OPTIONS",
  headers:{Origin:"https://other-family.example.invalid","Access-Control-Request-Method":"GET"}});
must(!cross.headers.get("access-control-allow-origin"),"untrusted origin must not be admitted");
const discovery=await fetchSafe(issuer+"/.well-known/openid-configuration");
must(discovery.status===200,"OIDC discovery reachable");
const md=await discovery.json();
must(md.issuer===issuer,"OIDC exact issuer");
must(md.jwks_uri===issuer+"/protocol/openid-connect/certs","pinned OIDC JWKS");
must(md.response_types_supported?.includes("code"),"authorization code flow");
must(md.code_challenge_methods_supported?.includes("S256"),"PKCE S256");
const keys=await fetchSafe(md.jwks_uri);
must(keys.status===200,"OIDC public key endpoint");
must((await keys.json()).keys?.some(k=>k.kty==="RSA"),"RSA public signing key");
const idHeader=discovery.headers.get("strict-transport-security");
must(idHeader,"OIDC HSTS");
process.stdout.write("Family OS live staging public-boundary certification passed: HTTPS identity discovery, JWKS, API 401, exact CORS, hidden readiness and HSTS.\n");
process.stdout.write("Not covered: human OIDC login/MFA, multi-user authorization, health of external backups or GitHub Pages publication.\n");
