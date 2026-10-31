import {createHash} from "node:crypto";
import {createRemoteJWKSet,jwtVerify} from "jose";
export type Principal={actorId:string;issuer:string;subject:string};
export type OidcConfig={issuer:string;audience:string;jwksUri:string};
export function actorIdFor(issuer:string,subject:string):string{
  const digest=createHash("sha256").update("family-os/oidc-subject/v1\0").update(issuer).update("\0").update(subject).digest();
  const bytes=Buffer.from(digest.subarray(0,16));bytes[6]=(bytes[6]&0x0f)|0x50;bytes[8]=(bytes[8]&0x3f)|0x80;
  const h=bytes.toString("hex");return [h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20)].join("-");
}
export class InvalidAuthentication extends Error{
  constructor(){super("A valid bearer access token is required.");this.name="InvalidAuthentication";}
}
export function createOidcVerifier(config:OidcConfig){
  const keys=createRemoteJWKSet(new URL(config.jwksUri),{timeoutDuration:5000,cooldownDuration:30000,cacheMaxAge:600000});
  return async function verify(header:string|undefined):Promise<Principal>{
    const match=/^Bearer ([A-Za-z0-9._~-]+)$/.exec(header||"");
    if(!match)throw new InvalidAuthentication();
    try{
      const {payload}=await jwtVerify(match[1],keys,{issuer:config.issuer,audience:config.audience,
        algorithms:["RS256"],clockTolerance:5,maxTokenAge:"60 minutes"});
      if(typeof payload.sub!=="string"||!payload.sub||payload.sub.length>255||
         typeof payload.iat!=="number"||typeof payload.exp!=="number")throw new InvalidAuthentication();
      return {actorId:actorIdFor(config.issuer,payload.sub),issuer:config.issuer,subject:payload.sub};
    }catch{throw new InvalidAuthentication();}
  };
}
