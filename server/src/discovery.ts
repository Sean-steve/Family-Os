import {z} from "zod";
import type {OidcConfig} from "./auth.js";

/**
 * Production startup gate: the independently configured JWT trust anchors
 * must be published by the exact configured HTTPS issuer. The API must NOT
 * accept a JWKS hosted by another site merely because it is configured.
 */
const discovery=z.object({
  issuer:z.string().url(),
  jwks_uri:z.string().url(),
  authorization_endpoint:z.string().url(),
  token_endpoint:z.string().url(),
  response_types_supported:z.array(z.string()),
  code_challenge_methods_supported:z.array(z.string()).optional()
});
const jwks=z.object({
  keys:z.array(z.object({
    kty:z.string(),kid:z.string().min(1),use:z.string().optional(),alg:z.string().optional()
  }).passthrough()).min(1)
});
export type DiscoveryAttestation={issuer:string;jwksUri:string;authorizationEndpoint:string;tokenEndpoint:string;rsaSigningKids:number};
export class UntrustedProvider extends Error{
  constructor(){super("The configured OIDC provider failed the issuer, HTTPS, metadata or JWKS trust check.");this.name="UntrustedProvider";}
}
const same=(a:string,b:string)=>a.replace(/\/+$/,"")===b.replace(/\/+$/,"");
const trusted=(url:URL,origin:URL)=>url.protocol==="https:"&&url.origin===origin.origin&&!url.username&&!url.password&&!url.hash;
/** Fail closed on unreachable or inconsistent discovery and public signing keys. */
export async function attestProvider(config:OidcConfig,fetcher:typeof fetch=fetch):Promise<DiscoveryAttestation>{
  try{
    const issuer=new URL(config.issuer),pinnedKeys=new URL(config.jwksUri);
    if(issuer.protocol!=="https:"||issuer.username||issuer.password||issuer.hash||issuer.search||
      !trusted(pinnedKeys,issuer)||pinnedKeys.search)throw new UntrustedProvider();
    const discoveryUrl=issuer.href.replace(/\/+$/,"")+"/.well-known/openid-configuration";
    const get=async(url:string)=>{
      const response=await fetcher(url,{method:"GET",redirect:"error",cache:"no-store",
        headers:{"Accept":"application/json"},signal:AbortSignal.timeout(8000)});
      if(!response.ok)throw new UntrustedProvider();
      // Limit remote metadata processing even when malicious issuer is configured.
      const length=Number(response.headers.get("content-length")||"0");
      if(length>131072)throw new UntrustedProvider();
      const value=await response.text();
      if(value.length>131072)throw new UntrustedProvider();
      return JSON.parse(value) as unknown;
    };
    const parsed=discovery.parse(await get(discoveryUrl));
    const declaredJwks=new URL(parsed.jwks_uri);
    if(!same(parsed.issuer,config.issuer)||!same(parsed.jwks_uri,config.jwksUri)||
      !trusted(declaredJwks,issuer)||!parsed.response_types_supported.includes("code")||
      !parsed.code_challenge_methods_supported?.includes("S256")||
      !trusted(new URL(parsed.authorization_endpoint),issuer)||
      !trusted(new URL(parsed.token_endpoint),issuer))
      throw new UntrustedProvider();
    const parsedKeys=jwks.parse(await get(config.jwksUri));
    const signingKeys=parsedKeys.keys.filter(k=>k.kty==="RSA"&&
      (k.use===undefined||k.use==="sig")&&
      (k.alg===undefined||k.alg==="RS256"));
    if(!signingKeys.length)throw new UntrustedProvider();
    return {issuer:parsed.issuer,jwksUri:parsed.jwks_uri,
      authorizationEndpoint:parsed.authorization_endpoint,tokenEndpoint:parsed.token_endpoint,
      rsaSigningKids:signingKeys.length};
  }catch{throw new UntrustedProvider();}
}
