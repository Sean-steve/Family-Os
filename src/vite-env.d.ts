/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FAMILY_API_URL?: string;
  readonly VITE_FAMILY_OIDC_AUTHORITY?: string;
  readonly VITE_FAMILY_OIDC_CLIENT_ID?: string;
  readonly VITE_FAMILY_OIDC_SCOPE?: string;
}
