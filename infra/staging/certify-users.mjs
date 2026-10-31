#!/usr/bin/env node
// DESTRUCTIVE TO STAGING TEST DATA ONLY: creates a permanent test family and
// temporary membership records. No private child, health or profile information.
import {randomUUID} from "node:crypto";
if(process.env.FAMILY_STAGING_CERTIFY_ACK!=="YES_CREATE_STAGING_TEST_RECORDS")
  throw new Error("Explicit staging test-record approval required.");
const host=process.env.FAMILY_API_DOMAIN||"";
const tokenA=process.env.FAMILY_STAGING_OWNER_TOKEN||"";
const tokenB=process.env.FAMILY_STAGING_ADULT_TOKEN||"";
if(!/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(host)||!tokenA||!tokenB||tokenA===tokenB)
  throw new Error("Two distinct real OIDC access tokens and a real API hostname are required.");
const endpoint="https://"+host;
async function request(token,method,path,payload){
  const r=await fetch(endpoint+path,{
    method,redirect:"error",cache:"no-store",credentials:"omit",signal:AbortSignal.timeout(12000),
    headers:{"Authorization":"Bearer "+token,...(payload===undefined?{}:{"Content-Type":"application/json"})},
    ...(payload===undefined?{}:{body:JSON.stringify(payload)})
  });
  // Never log response bodies: they can contain invitation codes or PII.
  const raw=r.status===204?null:await r.json().catch(()=>null);
  return {status:r.status,body:raw};
}
const expectStatus=(x,status,step)=>{
  if(x.status!==status)throw new Error(step+" failed: HTTP "+x.status+" (expected "+status+")");
  return x.body?.data;
};
const owner=expectStatus(await request(tokenA,"GET","/api/v1/me"),200,"owner OIDC");
const adult=expectStatus(await request(tokenB,"GET","/api/v1/me"),200,"adult OIDC");
if(!owner?.id||!adult?.id||owner.id===adult.id)throw new Error("Distinct verified identities required");
const title="B1.1 STAGING CERTIFICATION "+randomUUID();
const family=expectStatus(await request(tokenA,"POST","/api/v1/families",{name:title}),201,"family creation");
if(!family?.id)throw new Error("Family ID missing");
const path="/api/v1/families/"+family.id;
expectStatus(await request(tokenB,"GET",path),404,"pre-invite family isolation");
const home=expectStatus(await request(tokenA,"POST",path+"/households",
  {name:"B1.1 Certification Household",kind:"PRIMARY_HOME"}),201,"household create");
expectStatus(await request(tokenB,"GET",path+"/households"),404,"pre-invite household isolation");
const invite=expectStatus(await request(tokenA,"POST",path+"/invitations",
  {targetUserId:adult.id,role:"ADULT"}),201,"target-bound invitation issue");
if(!invite?.id||!invite?.code)throw new Error("Invitation issuance failed");
const claim="/api/v1/invitations/"+invite.id+"/accept";
expectStatus(await request(tokenB,"POST",claim,{code:"0".repeat(64)}),404,"wrong invite secret");
expectStatus(await request(tokenB,"POST",claim,{code:invite.code}),200,"bound invite redemption");
expectStatus(await request(tokenB,"POST",claim,{code:invite.code}),404,"invite replay");
const houses=expectStatus(await request(tokenB,"GET",path+"/households"),200,"adult household view");
if(!houses.items?.some(x=>x.id===home.id))throw new Error("Household missing for authorized adult");
expectStatus(await request(tokenB,"POST",path+"/households",{name:"Forbidden",kind:"OTHER"}),403,"adult mutation denial");
expectStatus(await request(tokenB,"GET",path+"/memberships"),403,"adult roster denial");
expectStatus(await request(tokenA,"PATCH",path+"/memberships/"+adult.id,{role:"GUEST"}),200,"owner role update");
expectStatus(await request(tokenB,"GET",path+"/households"),403,"guest household denial");
expectStatus(await request(tokenA,"PATCH",path+"/memberships/"+adult.id,{role:"ADULT"}),200,"restore adult role");
expectStatus(await request(tokenA,"DELETE",path+"/memberships/"+owner.id),404,"owner protection");
expectStatus(await request(tokenA,"DELETE",path+"/memberships/"+adult.id),204,"adult revocation");
expectStatus(await request(tokenB,"GET",path),404,"revocation immediately enforced");
expectStatus(await request(tokenB,"GET",path+"/households"),404,"household revocation immediately enforced");
expectStatus(await request(tokenA,"GET",path),200,"owner remains active");
process.stdout.write("B1.1 real two-token staging certification passed: issuer-bound distinct identities, family RLS, household scope, invite one-time semantics, role limits, owner protection and revocation.\n");
process.stdout.write("A synthetic test family remains in staging and must be cleaned up through an approved administrator-only maintenance process. No tokens, names or invite secrets printed.\n");
