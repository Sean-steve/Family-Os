# Family OS — Phase 8: Cross-Module UX Completion, Search & Frontend Certification

## Release intent and verdict criteria

Deliver a cohesive interactive Family OS frontend across all implemented domains, with privacy-conscious global navigation, working browser-local settings, truthful data presentation, and automated functional browser coverage. This phase **does not** claim production security, backend completion, verified family privacy, legal/clinical validation or live GitHub Pages publication.

The frontend remains an untrusted single-browser prototype. **Never enter identifiable child details, private stories, health records, personal legal documents or secrets in localStorage.** Existing Phase 1–7 fictional sample data is retained to demonstrate UI patterns.

## Implemented screens and navigation continuity

| Route | Experience | State of completion |
| --- | --- | --- |
| Dashboard | Source-linked family command center, dated task/event counts, evidence indicators and safe empty states | Functional local prototype |
| Family | Family members, households, relationships, roles (illustrative) | Functional local prototype, **not authorized identity** |
| Plan | Home planning and operations views | Functional local prototype |
| Calendar | Date-scoped family events, calendars and conflict visualization | Functional local prototype, no third-party calendar |
| Responsibilities | Assigned shared tasks, completion, recurrence and filters | Functional local prototype |
| Routines | Family routines and dates | Functional local prototype |
| Goals | Vision, values, missions, milestones, objectives and goals | Functional local prototype |
| Decisions | Drafts, simulated votes, proposals, reviewer labels and charter | Functional local prototype, not real governance authority |
| Experiences | Family outings, plans and explicit calendar linking | Functional local prototype |
| Memory | Stories, linked experiences, tradition history and archival | Functional local prototype, not private storage |
| Traditions | Recurrence, dated family moments and memory capture | Functional local prototype |
| Legacy | Wisdom, story/letter/heirloom metadata and memory references | Functional local prototype, no secure future release |
| Insights | Deterministic evidence signals, coverage, briefings and rule-based Chief of Staff | Functional local prototype, no LLM or cross-OS access |
| Search | Full navigation + designated shared-record global index; Ctrl/⌘ K dialog | Functional local prototype, deliberately excludes private records |
| Settings | Theme controls, local snapshot counts, privacy disclosure and confirmation-gated restoration of fictional sample dataset | Functional local prototype |
| Personal Mode | No distinct authenticated identity; cannot safely implement private personal workspace | **Not implemented** |
| Messages | Requires verified identities, conversations and privacy enforcement | **Not implemented** |

Navigation to implemented workspaces uses the same hash routing and responsive sidebar. Global search opens an owning module; shared tasks are filtered by their title, goals open their Goals tab with matching text, and explicitly dated shared events open their calendar date. These are **UI handoffs**, not cross-domain data writes.

## Privacy-scoped universal search

Files: \`src/search/model.ts\`, \`GlobalSearch.tsx\`, \`search.css\`.

- All implemented workspaces are navigable from Search (plus Settings).
- Record-level search indexes only **explicitly classified HOME/FAMILY tasks**, **dated HOME/FAMILY calendar events**, and **non-archived family goals**.
- Unclassified, archived or canceled source records are excluded.
- **Never indexes** full family/member profiles, private memories, legacy entries, sensitive family decisions, unclassified tasks, household addresses, health and financial details or message content.
- Search ranks direct title matches above token matches, supports result filters and presents ownership context.
- \`Ctrl/⌘ + K\` opens a focused modal dialog; arrow keys, Enter and Escape are supported.
- Searches execute entirely within the current browser. There is no backend search, auth boundary or private collection retrieval. This remains a privacy-preserving indexing design choice, **not proof of confidentiality**.

## Dashboard integrity repairs

- **Removed** the fixed \`Family Health = Good\`, risk count \`1\`, false “23% more consistent” routine improvement and fabricated holiday timing/workload claims.
- **Removed** static school, medical and vehicle maintenance notifications and the never-updating \`upcoming\` fixture from the dashboard. Historical \`AppData.upcoming\` remains only for backward-compatible persisted-data shape; it is not shown as a current event.
- **Removed** “Today” treatment of undated sample events/tasks: only explicitly dated HOME/FAMILY shared data contributes to current dashboard time windows.
- Replaced family-health status cards with honest \`Evidence & Connections\` conditions and missing specialized OS integrations.
- Notification panel now surfaces actual **local rule-based observations**, explicitly not push notifications or safety alerts.
- **Removed** third-party avatar requests, remote seed goal photos, Google Fonts and remote Unsplash hero images from Phase 1, Family and Strategy UIs. Visual identity uses initials and local gradients.
- Replaced misleading fixed profile identity, “Phase 1 only”/private-storage footer language and old phase-boundary statements.
- Added skip-to-content link, focus-visible styling, reduced-motion support, search ARIA listbox semantics and mobile search layouts.
- Settings reset requires typing \`RESET\` before replacing local data with fictional samples. No reset action is automatic.

## Canonical cross-module workflow certification

\`\`\`
Family members/households ───┐
Family Goals ─────────────────┼──> Experience [planned]
                             │           │
                        explicit        │ status=completed
                        Add to Calendar │
                             ▼           ▼
                     Canonical Event   Memory [draft]
                          (events)        │
                                          │ Add to legacy
                                          ▼
                                     Legacy [draft]
\`\`\`

The browser certification creates an experience through the UI, adds exactly one event through the explicit button, marks the experience completed, creates a linked memory, creates a legacy record with a \`linkedMemoryIds\` reference, and reloads the browser to prove persistence and reference integrity. Source models are not silently overwritten by navigation.

## Automated release gates

GitHub Actions PR workflow: \`.github/workflows/check.yml\`.

1. \`npm install --no-audit --no-fund\`
2. \`npm run typecheck\` — strict TypeScript, unused imports and type errors
3. \`npm run test\` — Vitest model and React render smoke tests for Phases 2–8
4. \`npm run build\` — production Vite build and \`tsc -b\`
5. \`npx playwright install --with-deps chromium\`
6. \`npm run test:e2e\` — real Chromium on a running **production preview**
7. Upload Playwright screenshots, traces and HTML report as GitHub Actions evidence artifacts

The browser suite checks:

- No fabricated dashboard claims or false “upcoming” events
- All Phase 1–7 workspaces plus Search have screens, not a placeholder
- Ctrl/⌘ + K search → Goals tab with matching goal title
- Shared responsibility search → source filter and context
- Global exclusion of sensitive memory/legacy records, even where the source screens contain examples
- Keyboard navigation, mobile sidebar, theme persistence
- Zero external image/font/profile network hosts in visited sample routes
- Serious/critical WCAG semantic tests on Search, excluding color-contrast rule (see exceptions)
- Guarded preview Settings reset
- Experience → Event → Memory → Legacy canonical-reference workflow and persisted reload

**Browser coverage scope:** Chromium only, desktop plus a simulated narrow viewport. It is not a full multi-browser, device-lab or assistive-technology manual test. **Color contrast is not automatically certified**: the axe contrast rule is deliberately excluded from the automated serious/critical search landmark check, and the broader application requires a complete human-led WCAG 2.2 AA audit before public production release.

## Production blockers and exceptions

- No real authentication, individual/guardian verification, family or household tenant isolation.
- No server-side row-level security, verified consent/revocation, sensitive media storage, audit integrity, message transport, subscriptions or cross-OS integration.
- No safety-critical AI or real chief-of-staff LLM; insights are deterministic browser rules and cannot authorize actions.
- The prototype is not secure for real private family information, particularly children's health, family relationships, inheritance, private memories, identity secrets or legal agreements.
- No backend load tests, pen test, DPIA/legal review, production backup/recovery certification or all-browser accessibility certification.
- GitHub Pages may remain **unpublished** because the connected GitHub App lacks permission to create the Pages site. Repo owner must select **Settings → Pages → Source: GitHub Actions** and rerun the deployment workflow. Test pass and merge do not prove public deployment.

## Exit criteria

Phase 8 is **frontend implementation complete** when all PR gates including the Playwright browser suite succeed. GitHub Pages is a separate owner action with independently verified deployment. The product as a whole is **not production ready**, and no security/clinical/legal certification is implied.

## Next development direction

**Phase B0 — Backend Architecture, Identity/Consent Boundaries & PostgreSQL Contracts** (if proceeding beyond the frontend): introduce real user/kernel subject mapping, family tenant identity, age-aware and purpose-sensitive privacy consent, secured event outbox/API contracts, protected media and migration of browser demo data only through an explicit, validated import flow. Do not import fictional seeded histories into production.
