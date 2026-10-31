# Family OS

Family OS is a family coordination and planning frontend prototype intended for eventual integration into HumanKernelOS. **Phase B0 now includes a separate backend foundation with PostgreSQL and signed OIDC access-token verification, but the frontend is still a browser-local preview. No real OIDC provider, frontend sign-in, secure personal domain, protected family media or live cross-OS integration is activated.**

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

## Backend Phase B0 — PostgreSQL & OIDC identity contracts

The new backend uses Node.js 22, Fastify 5, PostgreSQL 17, checked SQL migrations, a restricted API database role, signed OIDC RS256 JWT verification and family-scoped row-level security. It provides liveness/readiness, verified identity, and create/list/get family aggregate endpoints. Family creation persists an OWNER membership, audit event and outbox event atomically.

Backend engineering guide: [docs/phase-b0.md](docs/phase-b0.md).
API contract: [contracts/openapi.json](contracts/openapi.json).

Local setup: copy server/.env.example to an untracked .env.b0, replace placeholder database passwords and configure your real HTTPS OIDC issuer, JWKS URI and audience. Export those variables, run docker compose --env-file .env.b0 up -d postgres, then npm run db:migrate and npm run start:api.

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

Phase B1 — Authoritative Family Registry and Membership Services, verified guardian/child identity and consent safeguards, domain-specific RBAC/ABAC, first authenticated frontend-to-backend integration, protected media and governed Kernel contracts.
