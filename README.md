# Family OS

Family OS is a family coordination and planning frontend prototype intended for eventual integration into HumanKernelOS. **This repository currently has no backend, authentication, enforced privacy, protected family media, or live cross-OS integrations.**

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

## GitHub Pages

The Vite site base is `/Family-Os/`. The connected app cannot create the repository's Pages site; this requires a one-time owner action:

1. Open `https://github.com/Sean-steve/Family-Os/settings/pages`.
2. Select **Build and deployment → Source → GitHub Actions**.
3. Rerun `Build and deploy Family OS to GitHub Pages` on `main`.
4. Confirm deployment succeeded before using `https://sean-steve.github.io/Family-Os/`.

A green build and merged code do **not** mean that GitHub Pages was published.

## Next direction

Phase B0 — Authenticated Family OS backend, verified identity, child/guardian and consent safeguards, PostgreSQL contracts, authoritative event boundaries, protected media, durable audits and Kernel integration.
