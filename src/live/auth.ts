import {InMemoryWebStorage,UserManager,WebStorageStateStore,type User} from "oidc-client-ts";

export type LiveSettings={apiBase:string;authority:string;clientId:string;scope:string;redirectUri:string};
let manager:UserManager|null=null;
let callbackFailure="";
const empty=(v:unknown)=>typeof v==="string"?v.trim():"";
export function resolveLiveSettings(env:Record<string,unknown>,origin:string,base:string):LiveSettings|null{
  const api=empty(env.VITE_FAMILY_API_URL).replace(/\/+$/,"");
  const authority=empty(env.VITE_FAMILY_OIDC_AUTHORITY).replace(/\/+$/,"");
  const clientId=empty(env.VITE_FAMILY_OIDC_CLIENT_ID);
  if(!api||!authority||!clientId)return null;
  const target=new URL(api),provider=new URL(authority),here=new URL(origin);
  const isLocal=here.hostname==="localhost"||here.hostname==="127.0.0.1";
  if(!["http:","https:"].includes(target.protocol)||!["http:","https:"].includes(provider.protocol)||
    target.username||target.password||provider.username||provider.password||
    target.search||target.hash||provider.search||provider.hash||
    (!isLocal&&(target.protocol!=="https:"||provider.protocol!=="https:"))||
    (isLocal&&target.protocol==="http:"&&!["localhost","127.0.0.1"].includes(target.hostname)))
    throw new Error("Authenticated Registry requires trusted HTTPS identity and API origins.");
  const redirectUri=here.origin+(base.startsWith("/")?base:"/"+base);
  return {apiBase:api,authority,clientId,scope:empty(env.VITE_FAMILY_OIDC_SCOPE)||"openid profile",
    redirectUri};
}
export const liveSettings=(()=>{try{
  return resolveLiveSettings(import.meta.env as Record<string,unknown>,
    typeof window!=="undefined"?window.location.origin:"http://localhost:5173",import.meta.env.BASE_URL);
}catch{return null;}})();

export function getLiveManager():UserManager|null{
  if(!liveSettings||typeof window==="undefined")return null;
  if(!manager)manager=new UserManager({
    authority:liveSettings.authority,client_id:liveSettings.clientId,
    redirect_uri:liveSettings.redirectUri,response_type:"code",scope:liveSettings.scope,
    loadUserInfo:false,automaticSilentRenew:false,monitorSession:false,
    // Access tokens remain IN MEMORY only; the short-lived PKCE correlation
    // state is kept in sessionStorage across the OAuth redirect.
    userStore:new WebStorageStateStore({store:new InMemoryWebStorage()}),
    stateStore:new WebStorageStateStore({store:window.sessionStorage,prefix:"family-os-pkce:"})
  });
  return manager;
}
export async function finishLiveCallback():Promise<void>{
  const url=new URL(window.location.href);
  if(!url.searchParams.has("state")||
    !(url.searchParams.has("code")||url.searchParams.has("error")))return;
  if(url.pathname!==new URL(liveSettings?.redirectUri||window.location.href).pathname)return;
  try{
    const oidc=getLiveManager();
    if(!oidc)throw new Error("Registry authentication not configured");
    await oidc.signinRedirectCallback();
    callbackFailure="";
  }catch{callbackFailure="Identity provider sign-in could not be verified. Please retry from the registry.";}
  finally{
    // Remove authorization parameters immediately, including from browser history.
    window.history.replaceState(null,"",window.location.origin+
      window.location.pathname+"#/Live%20Registry");
  }
}
export function liveCallbackError():string{return callbackFailure;}
export async function startLiveLogin():Promise<void>{
  const oidc=getLiveManager();if(!oidc)throw new Error("Trusted OIDC provider not configured.");
  callbackFailure="";
  await oidc.signinRedirect();
}
export async function liveUser():Promise<User|null>{
  const oidc=getLiveManager();if(!oidc)return null;
  const user=await oidc.getUser();
  return user&&!user.expired&&user.access_token?user:null;
}
export async function endLiveSession():Promise<void>{
  const oidc=getLiveManager();if(oidc)await oidc.removeUser();
  callbackFailure="";
}
export async function liveRequest<T>(user:User,path:string,
  method:"GET"|"POST"|"PATCH"|"DELETE"="GET",body?:unknown):Promise<T>{
  if(!liveSettings||!user.access_token||user.expired)throw new Error("Sign in again to continue.");
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),12000);
  try{
    const response=await fetch(liveSettings.apiBase+path,{
      method,cache:"no-store",credentials:"omit",redirect:"error",mode:"cors",signal:controller.signal,
      headers:{Authorization:"Bearer "+user.access_token,
        ...(body===undefined?{}:{"Content-Type":"application/json"})},
      body:body===undefined?undefined:JSON.stringify(body)
    });
    if(response.status===204)return undefined as T;
    if(response.status===401)throw new Error("Session expired or not authorized. Sign in again.");
    const payload:unknown=await response.json().catch(()=>null);
    if(!response.ok){
      const error=payload&&typeof payload==="object"&&"error" in payload?
        (payload as {error?:{code?:string}}).error?.code:"";
      throw new Error(error==="FORBIDDEN"?"This role is not permitted to perform that operation.":
        error==="NOT_FOUND"?"The requested record is unavailable or not visible.":
        error==="CONFLICT"?"Another existing family record conflicts with this request.":
        error==="INVALID_TARGET"?"Recipient must first activate their verified account.":
        error==="VALIDATION_ERROR"?"Please review the form values.":"This operation could not be completed.");
    }
    return payload as T;
  }finally{clearTimeout(timeout);}
}
