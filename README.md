# Family OS

Family OS is a family coordination and planning frontend prototype intended for eventual integration into HumanKernelOS. **Phase B1 adds a real authenticated Live Registry frontend and role-governed PostgreSQL family/household APIs. The original family dashboards and individual-domain screens remain fictional browser-local previews. An actual OIDC provider/API deployment is not activated or publicly hosted by this repository.**

## Frontend scope — Phases 1–8

The interactive premium UI includes the Family Dashboard, Members & Households, Plan, Calendar, Responsibilities, Routines, Family Vision & Goals, Decisions, Experiences, Memory Timeline, Traditions, Legacy, Family Intelligence & Insights, universal Search, and browser-local Settings. Some high-impact features such as private Personal Mode and Messages remain **unimplemented pending real identity and permissions**.

**All seeded family details are fictional.** Browser `localStorage` is unencrypted and unsuitable for personal or child data. Do not enter real sensitive information in the public preview.

Read the detailed implementation and limitations at `docs/phase-8.md`.

## Development and release gates

```bash
npm install --no-audit --no-fund
npm run dev
npm run typecheck
npm run test
npm run build
npx playwright install chromium
npm run test:e2e
```

The end-to-end suite runs the built frontend using Playwright Chromium. The PR workflow also installs system dependencies and exports browser test artifacts. Search and command center tests include automated serious/critical WCAG semantic checks, with contrast and wider assistive-technology coverage **not yet certified**.

## Search & privacy behavior

Ctrl/⌘ + K opens a modal search. The full Search workspace is also available from navigation. Search indexes route names and explicitly shared family tasks, dated shared events, and non-archived goals. Private memories, family decisions, personal profiles and legacy stories are deliberately excluded. **This is only a data-indexing restriction, not authenticated access control.**

## Backend Phase B0/B1 — Authenticated Family Registry & PostgreSQL

The backend uses Node.js 22, Fastify 5, PostgreSQL 17, checked SQL migrations, a restricted API database role, signed OIDC RS256 JWT verification and family-scoped row-level security. B1 adds household CRUD, owner-only adult/guest membership governance, identity-bound expiring invitation redemption, audit and transactional outbox.

Backend engineering guides: [B0](docs/phase-b0.md) and [B1](docs/phase-b1.md).
API contract: [contracts/openapi.json](contracts/openapi.json).

Local setup: copy server/.env.example to an untracked .env.b0, replace placeholder database passwords and configure a real HTTPS OIDC issuer, JWKS URI and audience. Export variables, start PostgreSQL using Docker Compose, then run npm run db:migrate and npm run start:api. Apply both migrations 0001/0002.

For the authenticated UI, configure the public PKCE client variables from config/frontend.env.example in root .env.local. The Live Registry route requires a separately deployed HTTPS API and trusted OIDC provider. Without them, its UI is intentionally disabled and makes no API requests. Access tokens are kept in memory only; no browser demo data is promoted into PostgreSQL.

Verification: npm run typecheck:api; npm run test:api (requires migrated PostgreSQL; uses ephemeral test JWKS, NOT an activated identity service).

Never expose admin database credentials, import fictional frontend sample records as real data, or treat family role labels or localStorage as authenticated access.

## GitHub Pages

The Vite site base is `/Family-Os/`. The connected app cannot create the repository's Pages site; this requires a one-time owner action:

1. Open `https://github.com/Sean-steve/Family-Os/settings/pages`.
2. Select **Build and deployment → Source → GitHub Actions**.
3. Rerun `Build and deploy Family OS to GitHub Pages` on `main`.
4. Confirm deployment succeeded before using `https://sean-steve.github.io/Family-Os/`.

A green build and merged code do **not** mean that GitHub Pages was published.

## Next direction

Phase B1.1 — Real OIDC Provider Activation, Staging & Full Security Certification. Then Phase B2 — Durable Family Operations, Goals and Governance APIs. Child/guardian identity and private cross-OS consent remain guarded blockers.
