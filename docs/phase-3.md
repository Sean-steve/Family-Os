# Family OS — Phase 3: Family Operations

## Objective
Deliver **complete interactive frontend-only** experiences for shared calendar, household responsibilities, recurring routines, and coordinated family planning, while preserving Phase 1 dashboard and Phase 2 family/household data.

## Delivered experiences
| Area | Workflow |
| --- | --- |
| Family Coordination / Plan | Selected-date agenda, responsibilities, routines, unassigned work, shared task load, attendee schedule overlaps, family huddle notes (add/edit/pin/archive) |
| Calendar | Month and week grids, date navigation, selected-date agenda, household/family attendee selection, create/edit/cancel events, future events shown on command center |
| Responsibilities | Search, member/household/date filters, open/completed/archived categories, priority and category, due date, multiple assignees, recurring templates, completion and undo, edit/archive/restore |
| Routines | Daily/weekdays/weekly cadence, household and participant selection, step-based checklists, date-specific completion, skip/undo, pause/resume, create/edit |
| Dashboard connection | Today event count, today timeline, open responsibilities and progress, upcoming user-created dated events, quick actions to full forms |
| Cross-feature navigation | Plan ↔ Calendar ↔ Responsibilities ↔ Routines; family people and household selections use Phase 2 records |

## Data and consistency decisions
- React + TypeScript, with no backend or external APIs. All changes use the Phase 1 `family-os-preview-v1` localStorage key.
- The existing task and event arrays remain the single sources of truth in preview memory. Their type contracts are extended, **not forked**, so no duplicate task or event datasets are introduced.
- `operations` houses routine definitions, per-date step completion, skips, and family notes.
- Existing Phase 1 and 2 localStorage gets its missing `operations` object added through a migration, preserving family, members, tasks, goals and events.
- Legacy sample events without an explicit date remain today's illustrative events; legacy sample task due strings are anchored to Today or Tomorrow. New records use explicit ISO date-only values.
- ISO date keys use Africa/Nairobi civil dates with UTC-only arithmetic for stable recurrence calculations.
- Weekly recurrence anchors to the first due date. Daily and weekday recurrence are evaluated without background jobs.
- An event conflicts with another only when the date and time windows overlap and at least one assigned attendee matches. Overlap detection is advisory.
- Completed occurrences are tracked by date on recurring tasks and routine steps. A completed day does not permanently complete a recurring definition.
- Archived tasks and canceled events remain in browser memory; only active records appear in default views.
- Family notes are shared design previews; **no permission, privacy or consent enforcement exists**.

## Visual requirements
Maintain premium navy/white design system, scenic hero, rounded white panels, semantic status tones, accessible buttons/labels, responsive layouts and reduced-motion support.

## Certification commands
```bash
npm install
npm run typecheck
npm test
npm run build
```

## Explicit non-goals and risks
- No authenticated shared accounts, synchronization between family members/devices, push/email/SMS reminders, external calendar integration or backend scheduler.
- No real-time notifications, AI intelligence, background execution or financial/health connections.
- Browser localStorage is **unencrypted**. Do not enter real children’s details, medical records, private addresses or family secrets in the public demo.
- Preview suggestions and notes are fictional, and load indicators are counts of assigned tasks — not objective measures of family wellbeing or fairness.
- Extending localStorage state is a demonstration contract, not a canonical backend schema.
- GitHub Pages site activation must be performed by the repository owner if the Actions site-configuration step lacks permissions.

## Phase 4 handover
Next build Family Vision, Values, Missions, Goals, Milestones, Objectives and Strategy, linking the new operations' capacity/planning concepts without replacing Phase 3 scheduling truth.
