# Family OS — Phase 4: Family Goals & Strategy

## Objective
Complete frontend-only experiences for Family Vision, Family Values, Missions, Milestones, Objectives, Family Goals, Progress Tracking and Family Strategy Reviews while preserving Phase 1–3 data and navigation.

## Canonical hierarchy
```
Vision
  -> Missions (value-linked, owner-assigned)
    -> Milestones (dated checkpoints)
      -> Objectives (measurable outcomes)
        -> Goals (the existing canonical AppData.goals)
```

Strategy aggregates are held in `AppData.strategy`; the existing `AppData.goals` remains canonical. No duplicated goal list is maintained. Roll-up progress is calculated only from linked goals and displayed as **—** when there is no evidence.

## Screens and workflows
- **Strategy Overview:** North Star card, values, active mission progress, upcoming milestone and canonical goal momentum.
- **Vision & Values:** edit/version family vision, time horizon, add/edit/reorder/restore/archive values and inspect version history.
- **Missions:** create/edit/archive mission records, priorities, target dates, owners, supporting family values, linked milestones and progress.
- **Milestones:** mission-linked checkpoints, statuses, target date, completion date, descendant objectives, progress and next-step creation.
- **Objectives:** milestone-linked, owner-assigned measurable outcomes, metrics and targets, add goals and progress.
- **Goals:** canonical family goal editing, classification, owner/target/objective links, progress updates with timestamped history, archived view, detailed progress drawer and status filtering.
- **Reviews:** dated family reflection journal with wins, challenges, next steps and authors.
- **Dashboard integration:** existing goal cards read canonical goal state; quick add enters the strategy goal editor; progress adjustments append history instead of silently replacing values.

## Migration and preview truth
- Legacy `family-os-preview-v1` localStorage records are migrated in memory by adding strategy and mapping seed goal IDs to their objective references. Existing user progress and custom goals are preserved.
- A clean install ships fictional Taylor-family preview goals and strategy for design demonstration only. They must not be interpreted as measured family outcomes.
- No server, real authentication, shared permissions, financial integration, AI planning, notification delivery or background scheduling.
- Archiving maintains linked records for history; status restoration is available through the editors when archived records are displayed. Child records are never silently deleted or automatically reparented.
- Review journal is local, not an approval system.
- Percentages represent user-entered goal progress, not independently verified metrics.
- Sensitive personal data must not be entered in a public GitHub Pages demo; browser localStorage is unencrypted.

## Quality gates
```bash
npm install
npm run typecheck
npm test
npm run build
```
Tests cover hierarchy progress, migration, empty evidence, parent linkage, progress updates, and overview screen rendering. GitHub Pages publication remains a separate gate requiring repository Pages configuration and success of the deploy workflow.

## Next
Phase 5 — Family Decisions & Governance: decision workspace, options/scenarios, approvals and constitution/policy experience. These screens must reuse strategy references and preserve the family-level decision authority boundaries.
