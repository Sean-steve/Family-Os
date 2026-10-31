# Family OS — Phase 6: Experiences, Memories, Traditions & Legacy

## Objective and architecture

Deliver fully interactive, high-fidelity **frontend-only** Family Life experiences. Continue the existing dashboard design and preserve Phases 1–5. Families should be able to connect lived experiences to future plans and shared story/history:

```
Family Members / Households ───────────────────┐
Strategy Goals ──► Experiences ──► Family Calendar event (explicit action)
                         │
                         └──► Memories ────────► Legacy Records
Traditions ──► Moments ──► Memories ───────────┘
```

**Source-of-truth boundaries:** `AppData.life.experiences`, `memories`, `traditions`, `legacy` are typed Family Life domain arrays. Member and household IDs refer to Phase 2, goal IDs refer to Phase 4 and calendar event IDs refer to Phase 3's canonical `events`. Converting a source item creates a new linked record, not a duplicate copy of the original. Family Memory records can have both experience and tradition links; legacy references memory IDs, not a duplicated memory collection.

## Screen inventory

| Workspace | Delivered screens and flows |
| --- | --- |
| Family Experiences | Experience board, stages IDEA → PLANNED → COMPLETED/CANCELLED, create/edit/archival, event date/time, household, members, location, goal association, explicit Add to Calendar, capture a memory from a completed experience |
| Memory Timeline | Chronological memory stories, story drafts and recorded labels, search/tag filters, members, date, experience/tradition links, media *placeholder and caption only*, visibility and consent review labels, archived memories, memory detail drawer and "Add to Legacy" |
| Family Traditions | Recurring weekly/monthly/yearly/occasional rituals, status pause/resume, member/household assignment, next occurrence display, add dated moments and historical notes, draft memory from a tradition |
| Family Legacy | Wisdom, story, heirloom metadata, letter and time capsule drafting, intended reveal date, custodian labels, family participants, memory links, archive/restore, detail reading and preservation label |

All workspaces share a responsive hero, four collection KPIs based on actual array counts, direct navigation, empty states and mobile layout. No invented family wellbeing indices or fabricated predictions appear.

## Contract, validation and rules

1. An experience can be an undated IDEA; adding a calendar event requires valid ISO date and 24-hour time.
2. **Add to Calendar is explicit, one-way and idempotent at the UI level:** an experience with a `linkedEventId` will navigate to Calendar rather than create a second event. Its calendar date/time are then edited in the Calendar workspace, not silently overwritten on future experience edits. New calendar entries use the canonical existing `AppData.events`.
3. Participants/goal links must refer to existing active members and non-archived goals when saving a new record.
4. Converting an experience creates a **DRAFT** memory with `experienceId`, date, members, initial story and `consent=NOT_RECORDED` / `visibility=REVIEW_FIRST`.
5. Converting a tradition creates a DRAFT memory referencing `traditionId`; recording a tradition moment appends a date-stamped local history entry.
6. Recording a memory with participating people requires a **consent-review label** other than `NOT_RECORDED`, but no label verifies consent or grants rights. Consent is not enforced across family members by a browser-only app.
7. Converting a memory to legacy creates a DRAFT legacy record referencing the memory's ID. Legacy entries can link multiple memory IDs; no memory content is silently overwritten.
8. Weekly recurrence uses configured weekday; monthly recurrence skips impossible days; annual recurrence validates month/day and handles leap years. Occasional rituals have no computed next date.
9. Archivings and status transitions preserve references and history. No automatic deletion cascades, no publication actions, no actual reminders.
10. Media is represented only through `PHOTO_PLACEHOLDER` and `VIDEO_PLACEHOLDER` label choices, with editable captions. **No binary uploads, file URLs, external user photos or real family media hosting.**
11. "PRIVATE_LABEL", "REVIEW_FIRST", legacy custodians and "intended reveal date" are drafting metadata only. LocalStorage is readable by the browser user; time capsules are not hidden or automatically delivered.

## Migration

- Preserve the existing `family-os-preview-v1` localStorage key.
- Extend `AppData` with `life: FamilyLifeState` and `normalizeLife()` to add Phase 6 state to earlier saved snapshots without replacing edited family members, operations, decisions, strategy or goals.
- Keep user-supplied empty arrays empty: empty means the user removed the demonstrations, not an invitation to reseed them.
- Fictional sample examples are included *only* on fresh sessions and migrated snapshots that do not yet contain a `life` object. This preview has no person identity checks or real family data authority.

## Privacy & child-safety boundary

A GitHub Pages site is public code. Browser localStorage is not protected private storage. Never store real child names, personal images, medical narratives, private addresses, inheritance documents, signatures, legal letters, or family secrets in the prototype. Future production architecture must implement authentication, role/age-aware rights, participant consent/revocation, purpose-specific privacy policies, protected media object storage, encrypted server persistence, audited access and retention/deletion workflows.

**Important:** The UI makes no representation that it can enforce consent, protect photos, schedule future revelations or transfer ownership. Those must be built as backend services with Kernel authority, verified identities and secure asset infrastructure.

## Quality gates

```bash
npm install --no-audit --no-fund
npm run typecheck
npm run test
npm run build
```

Unit tests cover migration, cross-OS references, date correctness, experience-to-calendar creation, memory validation/consent labels, archive timeline sorting, legacy links, recurrence rules and tradition history. Component smoke tests render all four routes.

## Next phase

**Phase 7 — Family Intelligence & Insights**, including evidence/provenance-aware insights and family briefings with strict "insufficient evidence" handling. No AI automation may be given new access rights by being introduced into a frontend preview.

## GitHub Pages

The repository Pages workflow is configured in source control; its site-creation call previously failed with `Resource not accessible by integration`. The repository owner must enable GitHub Pages **Settings → Pages → Build and deployment → Source: GitHub Actions** and rerun the deploy workflow. Do not call the site live until the deployment has succeeded.
