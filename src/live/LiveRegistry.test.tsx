import {describe,expect,it} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import LiveRegistry from "./LiveRegistry";
import {resolveLiveSettings} from "./auth";

describe("B1 safe browser sign-in configuration",()=>{
  const base={VITE_FAMILY_API_URL:"https://api.family.example",
    VITE_FAMILY_OIDC_AUTHORITY:"https://identity.family.example/realms/family",
    VITE_FAMILY_OIDC_CLIENT_ID:"family-os-spa"};
  it("never enables live registry with incomplete environment configuration",()=>{
    expect(resolveLiveSettings({},"https://family.example","/Family-Os/")).toBeNull();
    expect(resolveLiveSettings({...base,VITE_FAMILY_OIDC_CLIENT_ID:""},
      "https://family.example","/Family-Os/")).toBeNull();
  });
  it("requires secure production identity and API origins, no credentials in URLs",()=>{
    expect(()=>resolveLiveSettings({...base,VITE_FAMILY_API_URL:"http://api.family.example"},
      "https://family.example","/Family-Os/")).toThrow(/HTTPS/);
    expect(()=>resolveLiveSettings({...base,VITE_FAMILY_OIDC_AUTHORITY:"http://identity.family.example"},
      "https://family.example","/Family-Os/")).toThrow(/HTTPS/);
    expect(()=>resolveLiveSettings({...base,VITE_FAMILY_API_URL:"https://admin:password@api.family.example"},
      "https://family.example","/Family-Os/")).toThrow(/HTTPS/);
    expect(()=>resolveLiveSettings({...base,VITE_FAMILY_API_URL:"https://api.family.example/path?q=1"},
      "https://family.example","/Family-Os/")).toThrow(/HTTPS/);
  });
  it("supports explicitly local backend and issuer only when app itself is local",()=>{
    const local=resolveLiveSettings({VITE_FAMILY_API_URL:"http://127.0.0.1:3001",
      VITE_FAMILY_OIDC_AUTHORITY:"http://127.0.0.1:8080/realms/family",
      VITE_FAMILY_OIDC_CLIENT_ID:"family-os-spa"},"http://localhost:5173","/Family-Os/");
    expect(local?.redirectUri).toBe("http://localhost:5173/Family-Os/");
    expect(local?.scope).toBe("openid profile");
    expect(local?.apiBase).toBe("http://127.0.0.1:3001");
  });
  it("has correct provider callback base (no hash fragment or query)",()=>{
    const settings=resolveLiveSettings(base,"https://sean-steve.github.io","/Family-Os/");
    expect(settings?.redirectUri).toBe("https://sean-steve.github.io/Family-Os/");
    expect(settings?.authority).toBe("https://identity.family.example/realms/family");
  });
  it("renders an honest disabled state, never fabricated authenticated households",()=>{
    const rendered=renderToStaticMarkup(<LiveRegistry navigate={()=>undefined}/>);
    expect(rendered).toContain("server-authoritative");
    expect(rendered).toContain("Production identity connection is not configured");
    expect(rendered).toContain("No child enrollment");
    expect(rendered).not.toContain("You are signed in");
  });
});
