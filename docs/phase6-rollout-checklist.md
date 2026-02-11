# Phase 6 Rollout Checklist

## Scope
- Rollout messaging UX and reliability improvements from Phases 1-6.
- Includes Phase 7 visual parity updates where they affect shell interactions and control placement.
- Keep rollback path available at each stage.

## Stage 1: Internal Dogfood
- Audience: Fray core team only.
- Duration: 3-5 days.
- Entry criteria:
  - `npm run test`, `npm run test:coverage`, `npm run build`, and `npm run test:e2e` all passing on `main`.
  - Weekly metrics report generated from test dataset.
- Exit criteria:
  - No P0/P1 defects in chat send/paginate/moderation.
  - Dead click rate trend does not regress >10% versus baseline week.
  - At least 20 successful internal sessions.
- Rollback trigger:
  - Message send failure >2% in internal sessions.
  - Moderation action failures in more than 1 session.
- Rollback action:
  - Revert to previous release tag.
  - Disable new command palette + settings entry points behind release flag (if deployed with flags).

## Stage 2: Private Alpha
- Audience: selected power users and moderators.
- Duration: 1-2 weeks.
- Entry criteria:
  - Stage 1 exit criteria met.
  - No unresolved P1 defects.
- Exit criteria:
  - Median onboarding completion (welcome -> first message) under 90 seconds in observed alpha sessions.
  - Support ticket volume stable or decreasing week-over-week.
  - Moderation audit actions successfully recorded for all redaction scenarios tested.
- Rollback trigger:
  - Onboarding completion time regresses above 120 seconds median.
  - Permission/regression bug allows unauthorized moderation action.
- Rollback action:
  - Promote rollback release.
  - Freeze rollout and run regression triage before reattempt.

## Stage 3: Public Beta
- Audience: broad Fray users.
- Duration: staged by cohorts over 2+ weeks.
- Entry criteria:
  - Stage 2 exit criteria met.
  - CI quality gate workflow stable for 7 consecutive days.
- Exit criteria:
  - UX metrics trend stable or improving for 2 weekly windows:
    - message send success up or stable
    - dead click rate down or stable
    - settings completion up
    - moderation success stable
- Rollback trigger:
  - Any P0 outage on messaging, auth entry, or moderation.
  - Dead click rate increases >20% for two consecutive daily checks.
- Rollback action:
  - Immediate rollback to prior stable tag.
  - Publish incident summary and remediation plan before resume.

## Promotion Record Template
- Stage:
- Start date:
- End date:
- Exit criteria met (yes/no):
- Metrics snapshot:
- Issues discovered:
- Rollback executed (yes/no):
- Decision owner:
