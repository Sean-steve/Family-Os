# Family OS — Phase 5: Family Decisions & Governance

## Scope

A complete **frontend-only** prototype for structured decisions and family governance, using the existing Phase 1–4 navigation, family membership and strategy goal records.

## Implemented screens

| Workspace | Implemented experience |
| --- | --- |
| Governance Overview | Live pending input, review and resolved counts; constitution snapshot; policy highlights; recent local actions |
| Decisions | Search, status filters, draft proposals, option comparison, active participant selection, recorded simulated ballots, quorum, outcomes and required reviewer acknowledgments |
| Constitution | Shared preamble, articles, edit/add/remove articles, versioned historical snapshots |
| Policies | Family/household-scoped guidelines, categories, optional review labels, version numbers, edit/archive/restore |
| Family Meetings | Dated meeting notes, participants, facilitator, summary, next steps, linked decision references, archive/restore |
| Activity | Local preview event log of decision, policy, charter and meeting changes |

## Decision contract

```
DRAFT -> OPEN -> APPROVAL_PENDING -> RESOLVED
              \-> RESOLVED  (no required reviewers)
              \-> DECLINED  (one explicit reviewer rejection)
DRAFT or OPEN -> CANCELLED
```

- Only a valid **draft** can be opened: title, two nonduplicate options, eligible participants, and a quorum between 1 and the unique eligible member count.
- `castBallot` accepts one stored ballot per eligible participant, replacing their prior ballot while voting remains open; invalid members/options/closed votes are rejected.
- **MAJORITY** requires a unique winning option with strictly more than 50% of ballots cast after quorum.
- **UNANIMOUS** requires every eligible participant to vote for the same option, even when the proposal's minimum quorum is lower.
- **ADVISORY** permits a unique plurality winner after quorum but rejects ties.
- Vote closure is an explicit action, never performed by inference or automatically.
- When required reviewers are listed, the vote moves to **APPROVAL_PENDING**. All named reviewers must affirm before the outcome is **RESOLVED**. One rejection marks it **DECLINED**. No approval is assumed from silence.
- A resolved/rejected decision is not freely reopened: create a new proposal to revisit it.
- Proposal options are editable only before voting starts. Final votes and results remain recorded in local preview history.
- Decision outcomes reference existing Phase 4 goals where selected, without changing goal progress or launching actions.

## Governance and safety rules

The actor dropdown is explicitly a **simulation persona**. The browser has no login or proof of identity, and a user can select anyone to demonstrate voting and review flows. Therefore:

- Votes, approvals, role labels, charter articles and policies are **not authenticated, legally binding or enforceable**.
- Policies describing required review do not enforce authorization on other modules. Only a decision's explicit reviewers affect its simulated resolution.
- A family organizer has **no right** to someone else's private information because of the family role or constitution.
- Children and caregivers are not given verified authority by changing preview role labels.
- Policy or charter changes do not override Kernel security, individual consent, privacy, safety or law.
- Local activity history is *not* cryptographically verifiable, tamper-resistant, server-retained, or a production audit log.
- Never enter real child details, private family records, health information, addresses, signed approvals or legal agreements into a publicly hosted preview backed by unencrypted localStorage.

## Persistence and migration

- The existing `family-os-preview-v1` localStorage key is retained.
- `AppData.governance` is added by `normalizeGovernance()` during migration, preserving all Phase 1–4 modules, goals, tasks, family members and edits.
- `seedGovernance` provides two clearly fictional open example proposals, constitution articles and preview policies. Empty arrays supplied by the user are preserved.
- Activity events are bounded to a maximum of 250 local records to limit browser storage; the record is not permanent.
- `AppData.governance.decisions` is the single preview decision dataset. Counts, detail drawers and the Dashboard all read from that canonical state.

## Test and build checks

```bash
npm install
npm run typecheck
npm run test
npm run build
```

Unit tests cover migration, valid participant/quorum constraints, self-replacement of ballots, ties, majority/plurality distinction, unanimous eligibility, explicit approval gates, reviewer rejection, cancellation, constitution revisions and event-recording immutability. Component smoke tests verify the overview and the warning labels.

## Remaining for backend/integration

A real implementation will need Kernel identity, verified participant and guardian roles, policy/consent authorization gates, proofed approvals/signatures where appropriate, durable PostgreSQL records, server-side concurrency and vote uniqueness, immutable audit/event history, retention and legal access, family scope isolation, and workflow notifications. **This phase implements none of those controls.**

## Next phase

Phase 6 — Family Experiences, Memories, Traditions and Legacy. Reuse established family membership, household and governance references without duplicating their ownership.
