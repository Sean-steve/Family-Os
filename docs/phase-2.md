# Family OS — Phase 2: Family & Household Management

## Status
Implemented in React/TypeScript as a frontend-only, interactive local preview. Phase 1 dashboard and existing browser data are preserved.

## Screens and workflows

| Section | Implemented experience |
| --- | --- |
| Family Overview | Editable family name and motto, member count, coordinator/carer count, children/teen count, household count, relationship count, family cards, household summary, relationship mini-tree |
| Members | Searchable/filterable member directory, profile cards, person details drawer, member add/edit, archive/restore |
| Family Tree | Parent-based generational visualization, tappable members, recorded connections and link creation |
| Households | Create/edit households, assign multiple members to multiple homes, choose primary home, archive non-final household |
| Relationships | Record partner, parent-of, sibling, guardian-of, grandparent-of and extended relationships; end records while preserving history |
| Roles & Access | Role catalogue, role-aware member assignment and illustrative capabilities matrix with explicit no-auth warning |

## Important rules

- A family always retains an active owner; changing or archiving the final owner is blocked.
- Relationship creation blocks nonexistent members, self-links, duplicate active links and parent/guardian cycles.
- Changing a member's role does **not** establish any legal relationship or verified guardian authority.
- Archiving a member retains their preview profile, ends active relationship links and removes active household assignments.
- Households may overlap; a person can belong to more than one household.
- Archiving the only active household is blocked. If primary home is archived, another active home becomes primary.
- All changes persist only in localStorage on this browser. No external server, login, identity authority, consent enforcement or database.
- Visibility labels and permission table are *not enforced*; do not enter real personal, child, medical or family secrets.
- The Taylor family is fictional demonstration data.
- Existing Phase 1 localStorage is migrated on load by supplying the new family structure, without replacing tasks, events, goals or previously added members.

## Test coverage

`src/family/model.test.ts` covers migration, last-owner protection, invalid/duplicate/self relationships, ancestor cycle detection, historical relationship re-creation, household assignment and primary-household exclusivity.

GitHub PR checks run:
- `npm run typecheck`
- `npm run test`
- `npm run build`

## Out-of-scope for Phase 2

- True authentication, backend account management, server-side policies, child verification and guardian authority.
- Multi-family switching and cross-family membership.
- Calendar, responsibility management and scheduling (Phase 3).
- Financial, medical, nutrition or asset integrations.
- Fully graph-based extended family spanning arbitrary households and verified legal relationships.
- Real AI, inferred wellbeing metrics and real permissions.

## Phase 3 handoff

Continue with **Family Operations:** shared calendar, household responsibilities, recurring routines and family coordination, using the same components and extending the existing typed local preview model.
