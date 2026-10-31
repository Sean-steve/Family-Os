# Family OS — Phase B0 Backend Foundation

## Architecture and execution

Phase B0 introduces a real, separately runnable backend without modifying the Phase 1–8 React interface or uploading fictional browser demo data. It is an engineering baseline, NOT an activated production identity provider, secure full-family product or publicly deployed API.

| Concern | Implementation |
| --- | --- |
| API runtime | Node.js 22, Fastify 5, TypeScript, Zod |
| Identity | OIDC RS256 signed bearer access tokens, pinned trusted JWKS, exact issuer and audience, iat/exp validation |
| Database | PostgreSQL 17, checksummed ordered migrations, separate migration administrator and unprivileged runtime role |
| Tenant isolation | Family aggregate, owned memberships, forced RLS, scoped transaction-local actor settings |
| Governance | Creator-only initial OWNER membership; consent grants reserved but not remotely readable or mutable |
| Reliability | Audit and outbox written atomically with family creation; inbox reserved, no worker yet |
| Contracts | Versioned OpenAPI 3.1 JSON in contracts/openapi.json |
| Tests | PostgreSQL-backed integration tests with ephemeral signed mock OIDC provider, CI migration repeatability |

The API database principal is always family_runtime; use DATABASE_ADMIN_URL only for migrations. The API rejects running as the database owner. SQL policies have ENABLE and FORCE RLS and only grant the runtime necessary operations. A tenant-creating transaction provisions a verified identity, creates a family, inserts the creator's OWNER membership, appends a minimal audit event and creates a family.created.v1 outbox event. A verified non-member is given 404 for a foreign family.

The API never trusts a role, identity or family authorization claim from browser data. This schema intentionally contains no authenticated child profile collection, no family member roster visibility, no server-side personal/health/finance details and no access to private memories. Consent grants exist as a reserved table but are not granted to the B0 runtime. No cross-OS data is read. Existing frontend localStorage data remains explicitly non-authoritative and is not migrated.

## Public and authenticated API routes

GET /health/live — public minimal liveness.

GET /health/ready — public minimal PostgreSQL readiness; gate this endpoint behind ingress protections when deployed.

GET /api/v1/me — verified OIDC identity, opaque actor ID and own active family count.

POST /api/v1/families — strict JSON body with name (2–120 characters). Returns 201 with id, name, OWNER role and createdAt; audit and outbox are transactional.

GET /api/v1/families — own active family memberships only, up to 50 records.

GET /api/v1/families/{familyId} — family view only when currently an active member; otherwise 404. Inputs are UUID-validated.

Client-facing validation, unauthenticated and not-found errors have stable safe shapes. No endpoint accepts invented userId/actorId or client-supplied role. Health routes reveal no secret configuration.

## Local setup

1. Copy server/.env.example to a private root-level .env.b0 and replace placeholders consistently. Configure your actual trusted HTTPS OIDC issuer, JWKS endpoint and audience; there is no bundled identity provider or magic admin token.
2. Export private environment variables in your shell (example on bash: set -a; source .env.b0; set +a).
3. Start local PostgreSQL using docker compose --env-file .env.b0 up -d postgres.
4. Run npm install --no-audit --no-fund.
5. Run npm run db:migrate (admin role; never from an untrusted web request). This will create the restricted runtime role on first setup if the admin is permitted to provision roles.
6. Run npm run typecheck:api and npm run test:api (the second requires the PostgreSQL test service).
7. Run npm run start:api. Default listener is 127.0.0.1:3001; GET /health/live must respond without auth.
8. Use an actual signed access token from your configured identity provider for authenticated API routes.

NEVER commit .env.b0 or database credentials or expose DATABASE_ADMIN_URL to client JavaScript. For production, provision roles and rotate secrets using the DBA/secret manager. Require PostgreSQL TLS and TLS reverse proxy, and restrict ingress. The local migration setup and ephemeral CI passwords do not constitute a hardened production rollout.

## Data ownership and safety

PostgreSQL domain tables: identities, families, memberships, households, consent_grants, audit_events, outbox, inbox. Audit and outbox are append-only to the API runtime; the worker delivery process is not created. The runtime cannot SELECT consent_grants or write inbox.

One person may belong to multiple families. Family OS has no authority to override individual HumanKernelOS data, finance, health or nutrition consent. In B0, child and guardian consent is not implemented; age-sensitive and private domain routes are deliberately absent. Family roles are not yet enforced for broad mutation privileges beyond initial owner bootstrap. Child/guardian verification, purpose-based ABAC, audit retention and safe family account switching belong to later backend phases.

The rate limiter is local to the API process and will require a shared distributed store before horizontal scaling. The API's no-store headers and CORS origin restrictions do not replace authentication, TLS, database isolation or privacy.

## CI certification

The existing frontend CI remains in place (TypeScript, Vitest, production build and Chromium E2E). A separate backend job runs ephemeral PostgreSQL 17, strict API TypeScript, twice-applied checksum migrations, and tests covering:

- missing/malformed/wrong-audience/expired tokens
- issuer-qualified opaque identity mapping
- atomic family, owner membership, audit and outbox durability
- foreign family returning 404 under another valid token
- direct runtime-role RLS visibility and denied consent-grant access
- strict input validation and API-contract boundaries

The test issuer is locally generated and is not a real provider activation. Passing the tests proves a local backend foundation, not cross-provider OIDC staging or production security certification.

## Next

Phase B1 — Authoritative Family Registry, Household Membership, Invitation Security, RBAC/ABAC, verified guardian/child safety and first frontend-to-backend authenticated flows. No real family-sensitive data should be accepted until those safeguards are operating.
