# Family OS — Phase B1.1: Identity Activation and Staging Certification

## Status

Phase B1.1 builds a staging-capable identity and API deployment, provider trust checks, and live certification harnesses. Code validation is independent of actual hosting.

**Not yet activated:** no staging server credentials, managed PostgreSQL connection secrets, owned DNS, production Keycloak administrator, OIDC users, or GitHub Pages enablement have been supplied through this connector. A green PR does NOT mean a live identity service exists. Public deployment and actual two-person browser login remain pending owner-controlled activation.

## Architecture

- React SPA continues using browser-side Authorization Code + PKCE and memory-only access tokens; the standalone Live Registry is authoritative only when connected to the API. Demo Family screens remain fictional and local-only.
- Keycloak 26.8.1 provides a staging OIDC realm called family-os-staging. No accounts, passwords or access tokens are committed. Public SPA client family-os-spa permits only the exact GitHub Pages callback and uses mandatory S256 PKCE. Access tokens must include the family-os-api audience. The realm disables public registration and password grants, uses short access-token lifespan, password policy, brute-force controls and TOTP enrollment.
- Caddy 2.11.7 provides automatic TLS, HSTS, a hidden readiness endpoint and identity administrator CIDR protection. Only 80/443 are published on the host.
- Fastify API is compiled into a minimal production Node container running as non-root and using a runtime-only DB account. The API performs signed OIDC JWT verification and OIDC provider metadata/JWKS trust attestation before starting.
- Two separately provisioned PostgreSQL databases are required: one for Family OS (migration admin + family_runtime accounts, forced RLS) and one for Keycloak (separate database account). These must use managed TLS with server certificate identity validation (verify-full for both Family and Keycloak databases), private ingress and independent backups.
- Database migrations are executed by a short-lived, explicit administrator-only job, not by the API process or normal container startup.

## Provider validation

On startup the API checks the configured HTTPS issuer's well-known discovery metadata, exact issuer and JWKS URL, trusted-origin token and authorization endpoints, S256 PKCE and RSA signing keys. The pinned runtime verifier continues to require RS256, configured issuer and audience, token expiry/issuance and a valid signature.

Missing/replaced/foreign JWKS, unavailable provider, insecure discovery URLs or missing PKCE support cause startup to fail closed. This is not an authorization replacement: each API call still validates its own bearer token.

Files: server/src/discovery.ts and server/tests/discovery.unit.spec.ts.

## Staging files

- infra/staging/api.Dockerfile — production ESM Node API image, nonroot.
- server/tsconfig.build.json — Node production compile; migration SQL bundled in container.
- infra/staging/compose.yaml — Keycloak/API/Caddy runtime, migration-only service.
- infra/staging/Caddyfile — HTTPS frontend for API and identity DNS names, admin CIDR.
- infra/staging/realm/family-os-staging-realm.json — no-users OIDC staging realm.
- infra/staging/.env.example — staging DNS, managed DB and password placeholders.
- infra/staging/preflight.mjs — rejects missing or unsafe live config, role and TLS settings.
- infra/staging/deploy.sh — requires private env file and explicit backed-up DB migration approval.
- infra/staging/verify-live.mjs — tests real HTTPS/OIDC discovery, signing keys, API authorization denial, CORS, no-store, HSTS and readiness hiding.
- infra/staging/certify-users.mjs — optional actual two-person bearer-token staging test covering family isolation, invite redemption/replay, role limits and revocation; creates a clearly marked synthetic staging family.
- .github/workflows/staging.yml — protected, manually invoked main-commit SSH deployment with pinned remote host keys.
- .github/workflows/check.yml — adds Compose, Caddy, production API container certification in CI.

## Required owner/operator activation

1. Approve an isolated staging host (with Docker Compose, Node 22 and SSH), identity/API DNS names, inbound 80/443 and hardened SSH. Do not reuse a production app's database or secrets.
2. Provision TWO managed TLS PostgreSQL databases, restricted users, reviewed CA trust, backups and restoration access. Confirm current migration checksums and snapshot before proceeding.
3. Copy infra/staging/.env.example into /srv/family-os/.env.staging on staging host, replace all placeholder values and chmod 600. Never commit, expose, or send secrets into Vite build variables.
4. Run node infra/staging/preflight.mjs /srv/family-os/.env.staging. Correct every reported failure; staging template mode is for CI only.
5. Configure GitHub Environment family-os-staging with required reviewers, variables FAMILY_STAGING_HOST and FAMILY_STAGING_USER, and secrets FAMILY_STAGING_SSH_KEY and FAMILY_STAGING_KNOWN_HOSTS. The known host key must be checked independently, not accepted blindly.
6. Invoke GitHub Actions workflow Family OS — protected staging activation on main, confirm that both managed databases have recent tested snapshots, and approve the protected environment. This deploys the exact main commit to the remote host. Without those real credentials, workflow cannot deploy.
7. In Keycloak, manually establish separate adult test identities and enroll TOTP. Ensure no client secret is assigned to family-os-spa and the browser client redirects only to https://sean-steve.github.io/Family-Os/.
8. Set frontend repository Actions public variables:
   VITE_FAMILY_API_URL=https://<real-api-host>
   VITE_FAMILY_OIDC_AUTHORITY=https://<real-identity-host>/realms/family-os-staging
   VITE_FAMILY_OIDC_CLIENT_ID=family-os-spa
   VITE_FAMILY_OIDC_SCOPE=openid profile (optional)
   Backend issuer must equal that authority; API audience is family-os-api. Do not put DB URLs or access tokens in VITE_* variables.
9. Repository owner must independently enable GitHub Pages in Settings -> Pages -> Source GitHub Actions. Existing workflows cannot create the Pages site through the connected GitHub integration.
10. Verify public ingress using node infra/staging/verify-live.mjs /srv/family-os/.env.staging on the staging operator's machine.

## Real two-user security acceptance

With two real independently signed OIDC sessions:

- Verify MFA challenge, login callback state validation, S256 PKCE, token signature and API audience, token expiry and local logout behavior.
- User A creates a server family and household; B gets NOT_FOUND until explicitly invited.
- A invites B's verified opaque user ID as ADULT/GUEST; wrong ID or code, expired invite or replay is rejected.
- B accepts once; ADULT can read non-sensitive households but not write them, view owner roster or invite others.
- OWNER may switch B between ADULT and GUEST, but cannot demote/revoke an OWNER through the limited API. GUEST cannot view household labels.
- Revoking B immediately returns 404 to subsequent B requests, even if its JWT remains unexpired.
- Confirm PostgreSQL RLS denies direct unauthorized role/consent access and that audit/outbox rows are durable.

The two-real-token acceptance script requires environment variables FAMILY_STAGING_OWNER_TOKEN and FAMILY_STAGING_ADULT_TOKEN and the explicit acknowledgement FAMILY_STAGING_CERTIFY_ACK=YES_CREATE_STAGING_TEST_RECORDS. Supply tokens through a private ephemeral operator shell, not GitHub logs/issues or chat. It prints no token or invitation secret, but creates a synthetic staging family that requires authorized cleanup. Never run this against live family data.

**Full live authentication certification is BLOCKED** until those provider-hosted tests and evidence are actually run. Green unit/CI tests are not a live staging attestation.

## Operational limits

This staging template does not provide production Keycloak clustering, managed cert rotation monitoring, backup/restore drills, DB failover, managed multi-instance rate limiting, detailed alerting, key rotation proof, privacy penetration testing, guardian/child verification, private profile/media storage, cross-OS consent, or lawful processing assessments. An API database credential compromise remains outside the actor-local RLS trust boundary.

Keycloak realm JSON import runs on new realm initialization; existing realms require a reviewed admin migration to make changes. A family OWNER does not acquire rights to another person's private Kernel/Finance/Health records.

## Next

Complete the owner-supplied infrastructure and identity activation prerequisites, run and store live two-user staging certification evidence, then proceed to Phase B2 — durable family operations/goals/governance API integration. Guardian/child consent and sensitive data remain outside B1.1.
