# Family OS — Phase 7: Family Intelligence & Insights

## Objective
Deliver a premium, interactive **frontend-only** Family Intelligence and Insights experience with deterministic, evidence-linked signals, explicit data gaps, human-approved next steps, locally saved family briefings, and a **rule-based (not generative AI)** Family Chief of Staff.

## Canonical integration
- `AppData` holds Phases 1–6 source-of-truth records: `tasks`, `events`, `goals`, `governance`, `life`, `family`, etc.
- `deriveSignals(data, asOf)` produces **ephemeral read projections**. No duplicated, persisted "facts" or independently authoritative interpretation objects.
- `AppData.intelligence` holds only user dismissals by evidence fingerprint and locally saved briefing *snapshots*.
- Source changes recalculate the signals and can invalidate an old dismissal.
- Calendar, Responsibilities, Goals, Decisions, Experiences and Traditions remain the authoritative editors. Phase 7 **never mutates their workflows**.

## Screens and outcomes

| Workspace | Delivered |
| --- | --- |
| Intelligence Command Center | Briefing overview, dated attention items, optional opportunities, source readiness and missing-data indicators |
| Family Insights & Risks | Filter by domain, tone and search; drill into evidence, rule version, source date, record, limitation and domain owner; hide / restore the current evidence fingerprint |
| Recommendations | Suggestions based on dated recorded events, with **navigation only** to the governing source; no auto-assigning, scheduling or decision-making |
| Briefings | Generate current summary from rule engine; save timestamped browser-local snapshots and reflection note; read old snapshots as **historical**, not revalidated facts |
| Family Chief of Staff | Four grounded prompt categories: attention, plans, traditions, data gaps. Controlled free-text classification into known categories and clear "unsupported" response for open-ended questions. Local deterministic templates only. No AI model, private retrieval or generated content |
| Dashboard Integration | Dynamic evidence-based KPI/attention rows replace invented "Family Health: Good", synthetic risk counts and fixed health/school/asset alert examples. Insights route activated |

## Evidence and rule specification

Each `Signal` contains an ID, evidence fingerprint, domain, tone, nature, title, factual summary, explicit why, source rule, limitation, as-of day, source date, evidence array, and a next-step navigation destination.

- **Shared overdue tasks:** Only explicit, historical ISO due dates, unfinished, one-time, classified HOME/FAMILY/OTHER. No legacy relative "Today" strings and no unclassified/HEALTH/SCHOOL/WORK tasks.
- **Unassigned upcoming tasks:** Explicitly dated shared tasks in the next 7 days where `assigneeIds` is present and empty. No inference from missing legacy data.
- **Family calendar overlaps:** Explicitly dated HOME/FAMILY events in the next 7 days, same calendar day and overlapping intervals with one or more common attendee IDs. Exclude health/school/work/private and date-less events.
- **Overdue goals:** Recorded elapsed `targetDate` and progress under 100%; explicitly self-reported, not independently verified finance or health outcomes.
- **Upcoming goals:** Active goals with recorded target date within 14 days and progress under 100%; no prediction of success.
- **Pending decisions:** Open/pending-review governance records; remind that approvals/identities are local unverified simulations.
- **Unlinked experiences:** Planned experiences with dates in next 14 days and no explicit calendar link.
- **Upcoming traditions:** Next occurrence calculated only from existing enabled recurrence rules in next 7 days, not a confirmation of attendance.

Signals may be **observations** or **review recommendations**. Signal tone ATTENTION is a scheduling review flag, not a medical, safety or legal risk classification. CELEBRATE indicates an upcoming family tradition (not evidence of family wellbeing). Nothing derives emotional cohesion scores, family health metrics, child profiles, asset risks, savings figures or financial forecasts.

## Missing-data / cross-OS policy

`evidenceCoverage(data)` displays:
- Family coordination: browser-dated records or insufficient data.
- Family goals: browser-stored, self-reported progress or insufficient data.
- Family decisions: browser-simulated records or insufficient data.
- **Finance OS: NOT_CONNECTED**
- **Health/Nutrition OS: NOT_CONNECTED**
- **Personal Kernel/HumanKernelOS: NOT_CONNECTED**

No private domain readings are fabricated or inferred. Future integrations require individual-specific and tenant-specific consent, purpose limitations, evidence provenance, mediating interfaces, revocation handling and kernel-level identity. The current UI has **zero identity, access-control or cross-OS permissions**.

## Chief of Staff integrity

The "chat" is a controlled, client-side rule interpreter. It can summarize recorded attention items, optional planning suggestions, upcoming traditions and known gaps. It rejects unsupported free-text requests. No language model, vector search, hidden prompts, external AI service, autonomous action or cross-OS synchronization. All follow-through occurs by a user opening the owning source view.

## Persistence and migration

- Existing localStorage key `family-os-preview-v1` stays unchanged.
- New `intelligence: {dismissals: [], savedBriefs: []}` is added to older saved snapshots with `migrateIntelligence()`.
- Dismissal stores `id + fingerprint + dismissedAt` but **does not edit source evidence** and becomes ineffective when evidence changes.
- Saved briefing snapshots preserve only titles, fingerprints and summary at capture time; not replicated private records.
- Unset/empty memory and other source collections are never reseeded by Phase 7.
- Snapshots and dismissals are user-editable local browser state, not immutable audit.

## Verification

```bash
npm ci
npm run typecheck
npm run test
npm run build
```

Unit tests cover empty-data behavior, dates, private/unclassified task exclusion, family-only event overlap, goal thresholds, governance/experience/tradition links, evidence provenance, dismissal invalidation, snapshot behavior and unknown connected systems. Component smoke tests verify dashboard labels, navigation and boundaries.

## Explicit production blockers

There is no authenticated family tenancy, record visibility enforcement, age-aware access, consent or revocation, encrypted storage, governance authorization, signed source provenance, forecasting service, actual AI model, background agent, notifications or cross-OS integration. GitHub Pages deployment still depends on repository owner activating Pages under **Settings → Pages → Source: GitHub Actions**.

## Next

**Phase 8 — Cross-Module UX Completion, Search & Preview Certification:** universal navigable search, phase-wide scenario validation, accessibility and privacy audits, no misleading sample statuses, complete frontend certification and GitHub Pages publishing verification.
