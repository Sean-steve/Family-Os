import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";

const realm=JSON.parse(readFileSync(
  new URL("../../infra/staging/realm/family-os-staging-realm.json",import.meta.url),"utf8")) as {
    realm:string;registrationAllowed:boolean;accessTokenLifespan:number;clients:Array<{
      clientId:string;publicClient:boolean;standardFlowEnabled:boolean;
      implicitFlowEnabled:boolean;directAccessGrantsEnabled:boolean;
      redirectUris?:string[];webOrigins?:string[];attributes?:Record<string,string>;
      protocolMappers?:Array<{protocolMapper:string;config:Record<string,string>}>
    }>;users?:unknown[];requiredActions?:Array<{alias:string;enabled:boolean;defaultAction:boolean}>
  };
describe("B1.1 Keycloak realm security contract",()=>{
  it("contains no committed user accounts and disables public self-registration",()=>{
    expect(realm.realm).toBe("family-os-staging");
    expect(realm.registrationAllowed).toBe(false);
    expect(realm.users||[]).toEqual([]);
  });
  it("restricts the public browser client to authorization-code S256 PKCE",()=>{
    const spa=realm.clients.find(x=>x.clientId==="family-os-spa")!;
    expect(spa.publicClient).toBe(true);
    expect(spa.standardFlowEnabled).toBe(true);
    expect(spa.implicitFlowEnabled).toBe(false);
    expect(spa.directAccessGrantsEnabled).toBe(false);
    expect(spa.redirectUris).toEqual(["https://sean-steve.github.io/Family-Os/"]);
    expect(spa.webOrigins).toEqual(["https://sean-steve.github.io"]);
    expect(spa.attributes?.["pkce.code.challenge.method"]).toBe("S256");
  });
  it("issues an API-audience access token, not an ID-token audience grant",()=>{
    const spa=realm.clients.find(x=>x.clientId==="family-os-spa")!;
    const audience=spa.protocolMappers?.find(x=>x.protocolMapper==="oidc-audience-mapper");
    expect(audience?.config["included.client.audience"]).toBe("family-os-api");
    expect(audience?.config["access.token.claim"]).toBe("true");
    expect(audience?.config["id.token.claim"]).toBe("false");
  });
  it("requires OTP enrollment and short access token lifetime",()=>{
    expect(realm.requiredActions?.some(x=>x.alias==="CONFIGURE_TOTP"&&x.enabled&&x.defaultAction)).toBe(true);
    expect(realm.accessTokenLifespan).toBeLessThanOrEqual(300);
  });
});
