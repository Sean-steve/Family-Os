# Family OS — Phase 1 certification

## Scope

- React 19, TypeScript, Vite 6 and Tailwind CSS 3 frontend.
- Modular typed frontend demo data contract.
- Responsive dashboard reproducing the approved design language: navy sidebar, scenic family hero, family member strip, six KPIs, attention queue, today schedule, upcoming events, goals, responsibilities, health status, insights.
- Fully navigable responsive shell (desktop/mobile), 2 display themes and keyboard search (Ctrl/Cmd + K).
- Functional local-only quick-create forms for member, goal, responsibility and event; completion toggles and goal progress adjustments.
- Notifications menu, family selector, contextual dialogs and phase-aware navigation destinations.
- Data persisted only in browser localStorage; reset by clearing site data.
- GitHub Pages configuration with /Family-Os/ base and static hash routing.

## Strict frontend-only boundaries

- No database, auth server, API, payment integration, event bus or AI inference.
- Taylor family and dashboard indicators are fictional examples, not factual health, finance or family wellbeing measurements.
- Any phase 2–8 screen opens an explicit, informative phase placeholder; it is not represented as complete.
- No private family data should be entered while the site is hosted publicly; localStorage is unencrypted browser storage.
- Portrait and landscape photographs are fetched from external photo hosts and require an internet connection.

## Phase 1 validation gate

- [x] npm run typecheck — GitHub PR check passed
- [x] npm run build — GitHub PR and main builds passed
- [ ] Main branch deployment workflow passes — **blocked by missing Pages site; see README activation steps**
- [ ] GitHub Pages URL confirmed live — pending Pages enablement
- [ ] Desktop and mobile visual QA
- [ ] Interaction checks: navigation, modal, create, toggles, theme, search, notification

## Phase 2

Replace the family placeholder with the complete Family & Household experience, preserving the existing design system and the absence of any backend.
