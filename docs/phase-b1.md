# Family OS — Phase B1 Engineering Report

## Scope and system boundary

Phase B1 delivers a real PostgreSQL-backed **authenticated family registry** and a separate frontend view called **Live Registry**. The original Family OS screens remain fictional, localStorage-driven visual prototypes. There is **no automatic synchronization or migration** of demo family members, households, memories, goals, children, decisions, or other sample records to the server.

The Live Registry connects by a configured OIDC Authorization Code + PKCE flow to the same Fastify API created in B0. Its backed records are server-authoritative. No production OIDC provider, API host or GitHub Pages permission has been activated as part of this implementation.

## Database migration and domain authority

Migration: server/migrations/0002_b1_registry.sql.

The database now contains family members as verified identity/membership references, and household labels and types with soft archival. Household names are non-sensitive labels only: no physical addresses, locations of minors, relationship records, health conditions, or private member profiles are accepted.

B1 migration:
- Adds strict household name/type/archival fields, timestamps and a partial unique index for one active primary home per family.
- Replaces the original broad household visibility with active OWNER, CO_PARENT or ADULT membership checks enforced by FORCE RLS. GUEST, TEEN and CHILD cannot access.
- Uses PostgreSQL SECURITY DEFINER role lookups to avoid recursive membership RLS. Each function resolves the current transaction's server-set, OIDC-verified actor and runs under a fixed search path. PUBLIC EXECUTE is revoked; only family_runtime can call.
- Restricts membership UPDATE to another ACTIVE ADULT/GUEST's role or revocation; OWNER and CO_PARENT cannot be elevated/demoted by these APIs.
- Adds an invitation table with 48-hour expiration (maximum 7 days by SQL constraint), verified target actor UUID, issuer, restricted ADULT/GUEST role, and SHA-256 of a cryptographically random 32-byte one-time code.
- Grants the API INSERT-only invitation access. The elevated redeem procedure verifies the intended authenticated subject, code hash, unused status and expiry before adding/reactivating one limited membership. Replay fails.
- Records every successful mutation's audit entry and event outbox row in the same transaction; events carry only opaque IDs and operation names, never invitation codes or private member metadata.

The server actor identity remains the issuer-qualified hash of the externally signed OIDC subject. No profile, contact address, email, legal guardianship status, or HumanKernelOS identity is presumed.

## Role and attribute access policy

OWNER can list verified adult/guest actor IDs, issue identity-bound invitations, update/revoke ADULT/GUEST roles, and manage household labels.

CO_PARENT can manage household labels, but cannot invite/remove others, create child identities or alter OWNER authority.

ADULT can read shared non-sensitive household labels, but cannot mutate or manage memberships.

GUEST can only see families to which they personally belong; no household/roster access.

TEEN and CHILD cannot be enrolled via B1. Guardian/child verification and age-aware ABAC must be introduced before expanding access.

All write endpoints recheck the server-derived role. Direct SQL tests prove family_runtime cannot grant OWNER or enroll a child, cannot read private consent grants, and cannot reach foreign family records. Last-owner protection is structural: B1 can only modify existing ADULT/GUEST rows.

A family OWNER is not legally empowered to view another individual's personal, health, finance, private memory or Kernel records.

## API contracts

The following signed OIDC access-token endpoints are added to OpenAPI 3.1 (contracts/openapi.json):

- GET /api/v1/families/{familyId}/households — adult family roles, max 100.
- POST /api/v1/families/{familyId}/households — OWNER/CO_PARENT.
- PATCH /api/v1/families/{familyId}/households/{householdId} — OWNER/CO_PARENT.
- DELETE /api/v1/families/{familyId}/households/{householdId} — soft archive.
- GET /api/v1/families/{familyId}/memberships — OWNER only; non-sensitive adult/guest roster.
- POST /api/v1/families/{familyId}/invitations — OWNER only, target must be previously signed-in verified actor.
- POST /api/v1/invitations/{invitationId}/accept — only the intended authenticated target with valid one-use code.
- PATCH /api/v1/families/{familyId}/memberships/{userId} — OWNER-only switch between ADULT/GUEST.
- DELETE /api/v1/families/{familyId}/memberships/{userId} — OWNER-only revoke ADULT/GUEST.

The recipient must first sign in and privately share their opaque actor ID with the issuer. The code is returned once. No email, phone, push or messaging delivery is fabricated. A recipient must privately obtain both invitation ID and code; the API rejects wrong subject or replay. The secret is not stored in browser persistent state or in the database in plaintext.

The existing B0 signed identity and family aggregate endpoints remain unchanged.

## UI/UX integration

New sidebar route: Live Registry (also linked from Family overview). The Live Registry supports:

- OIDC sign-in and local sign-out; verified actor display.
- Live family list, family switch, and creation in PostgreSQL.
- Non-sensitive household list, create, edit, and archive based on server role.
- OWNER-only verified adult/guest roster, one-time invitations, limited role changes and revocation.
- Identity-bound invitation acceptance.
- Immediate post-mutation API refresh and explicit server error states.

The original Family page now warns that its family profiles and sample households are fictional and provides a direct link to the authenticated registry. No demo data is uploaded.

### OIDC client security

The frontend uses oidc-client-ts Authorization Code with PKCE. OIDC access tokens are kept in memory only: a page reload requires signing in again. The temporary PKCE correlation state is held in sessionStorage for redirect continuity; access tokens are not placed in localStorage or sessionStorage. There are no client secrets or password forms.

The redirect is processed before App mounts, then the query code/state is removed from browser history. API calls use bearer Authorization to the configured trusted API, cache:no-store, credentials:omit, redirect:error, and a timeout.

Missing OIDC/API configuration produces a disabled, honest screen: no fake user, no browser token or invented server data.

## Activating a real identity provider and API

These steps need your real infrastructure/provider details; none have been fabricated:

1. Configure a trusted HTTPS OIDC issuer (for example your selected identity platform), public SPA client, Authorization Code + PKCE and the actual API audience family-os-api.
2. Register the callback https://sean-steve.github.io/Family-Os/ (and the local Vite callback if testing locally). Configure only the intended SPA web origins.
3. Run backend migrations with the separate admin role against the correct PostgreSQL database, then run the Fastify API under family_runtime with HTTPS ingress and trusted OIDC_ISSUER, OIDC_AUDIENCE, OIDC_JWKS_URI and exact APP_ALLOWED_ORIGINS.
4. Configure public Vite settings from config/frontend.env.example in root .env.local or GitHub Actions repository Variables: VITE_FAMILY_API_URL, VITE_FAMILY_OIDC_AUTHORITY, VITE_FAMILY_OIDC_CLIENT_ID and optional VITE_FAMILY_OIDC_SCOPE. Never place secrets, client passwords or database credentials in VITE_*.
5. Run the full frontend/backend CI and test real two-user sign-in, family creation, invitation acceptance, role changes, revocation and concurrent requests in staging.
6. GitHub Pages publishes the static frontend only, not the Fastify API/PostgreSQL server. Pages still requires its own repository activation permission.

## CI acceptance

The B1 backend integration suite uses ephemeral PostgreSQL 17 and an ephemeral signed mock OIDC JWKS endpoint. It asserts create/read/update/archive household persistence, tenant isolation, duplicate primary-home conflict, non-enrolment of minors, invitation secret hashing and replay rejection, access for intended identity only, ADULT/GUEST permissions, owner role protection, forced RLS, audit/outbox events, and immediate access loss on revocation.

Backend B0 tests continue to run; full frontend TypeScript, Vitest, Vite and Chromium checks remain required. Mock JWKS tests are not certification against a live provider, and automated tests are not a full penetration test or privacy impact assessment.

## Known limitations and next phases

Not included: guardian verification, legal custody, age-appropriate minor onboarding, consent/revocation policy for individuals, invited co-parent promotion, controlled ownership transfer, protected document storage, family relationship authorization, production session handling, rate-limit distribution, outbox workers, external system connectors, sensitive-domain APIs, real inbox messaging, full frontend migration of modules beyond Live Registry, secure deployment or cross-device data sync.

Next recommended phase: **B1.1 — Real OIDC Provider Activation, Security & Staging Identity Certification**, followed by **B2 — Durable Family Operations, Strategy, Governance and Experiences APIs**. Private family data should not enter the system until guardian/individual consent and protected storage are certified.
