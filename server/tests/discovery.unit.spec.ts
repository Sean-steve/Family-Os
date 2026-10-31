import {describe,expect,it,vi} from "vitest";
import {attestProvider,UntrustedProvider} from "../src/discovery.js";
const oidc={issuer:"https://id.family.test/realms/family",audience:"family-os-api",
  jwksUri:"https://id.family.test/realms/family/protocol/openid-connect/certs"};
const goodMetadata={
  issuer:oidc.issuer,jwks_uri:oidc.jwksUri,
  authorization_endpoint:oidc.issuer+"/protocol/openid-connect/auth",
  token_endpoint:oidc.issuer+"/protocol/openid-connect/token",
  response_types_supported:["code"],code_challenge_methods_supported:["S256"]
};
function fake(metadata:unknown=goodMetadata,keys:unknown={keys:[{kty:"RSA",kid:"test-key",use:"sig",alg:"RS256"}]}){
  return vi.fn(async(url:string|URL|Request)=>{
    const asString=String(url);
    const body=asString.endsWith("/.well-known/openid-configuration")?metadata:keys;
    return new Response(JSON.stringify(body),{status:200,headers:{"content-type":"application/json"}});
  }) as unknown as typeof fetch;
}
describe("B1.1 OIDC provider trust gate",()=>{
  it("attests exact issuer, same-origin JWKS, authorization-code PKCE and RSA signing keys",async()=>{
    const fetcher=fake();
    const evidence=await attestProvider(oidc,fetcher);
    expect(evidence).toEqual({
      issuer:oidc.issuer,jwksUri:oidc.jwksUri,
      authorizationEndpoint:goodMetadata.authorization_endpoint,
      tokenEndpoint:goodMetadata.token_endpoint,rsaSigningKids:1
    });
    expect(vi.mocked(fetcher)).toHaveBeenCalledTimes(2);
  });
  it("denies a swapped issuer, mismatched signing keys or external JWKS",async()=>{
    await expect(attestProvider(oidc,fake({...goodMetadata,issuer:"https://evil.test"}))).rejects.toBeInstanceOf(UntrustedProvider);
    await expect(attestProvider(oidc,fake({...goodMetadata,jwks_uri:"https://evil.test/keys"}))).rejects.toBeInstanceOf(UntrustedProvider);
    await expect(attestProvider({...oidc,jwksUri:"https://evil.test/keys"},fake())).rejects.toBeInstanceOf(UntrustedProvider);
    await expect(attestProvider(oidc,fake(goodMetadata,{keys:[{kty:"oct",kid:"bad",alg:"HS256"}]}))).rejects.toBeInstanceOf(UntrustedProvider);
  });
  it("refuses auth-code without S256 PKCE and insecure HTTP/foreign endpoints",async()=>{
    await expect(attestProvider(oidc,fake({...goodMetadata,response_types_supported:["token"]}))).rejects.toBeInstanceOf(UntrustedProvider);
    await expect(attestProvider(oidc,fake({...goodMetadata,code_challenge_methods_supported:["plain"]}))).rejects.toBeInstanceOf(UntrustedProvider);
    await expect(attestProvider(oidc,fake({...goodMetadata,token_endpoint:"https://evil.test/token"}))).rejects.toBeInstanceOf(UntrustedProvider);
    await expect(attestProvider({...oidc,issuer:"http://id.family.test/realms/family"},fake())).rejects.toBeInstanceOf(UntrustedProvider);
  });
  it("fails closed on absent, huge or inaccessible provider metadata",async()=>{
    const failing=vi.fn(async()=>new Response("{}",{status:503})) as unknown as typeof fetch;
    await expect(attestProvider(oidc,failing)).rejects.toBeInstanceOf(UntrustedProvider);
    const oversized=vi.fn(async()=>new Response("{}",{status:200,headers:{"content-length":"999999"}})) as unknown as typeof fetch;
    await expect(attestProvider(oidc,oversized)).rejects.toBeInstanceOf(UntrustedProvider);
    await expect(attestProvider(oidc,fake({...goodMetadata,jwks_uri:null}))).rejects.toBeInstanceOf(UntrustedProvider);
  });
});
