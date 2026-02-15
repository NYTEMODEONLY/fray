# ADR 0001: Minimal Client Boundary For Public Reliability

- Status: Accepted
- Date: 2026-02-14

## Context

Fray currently delivers both core chat workflows and a large admin/advanced surface in the same default experience. This makes onboarding and day-to-day reliability harder because core flows compete with complex settings logic for developer attention, testing focus, and runtime complexity.

To ship Fray as a trustworthy daily driver, the public default mode must optimize for stable chat-first behavior and low cognitive load while still allowing advanced capabilities to exist behind explicit gates.

## Decision

1. Define and preserve a core MVP boundary as first-class:
   - auth/session (login/register/logout)
   - spaces/rooms browsing + switching
   - timeline + composer
   - reactions + replies + basic pins
   - DMs + unread counters + notifications
   - basic user preferences (theme, density, enter-to-send)
2. Gate advanced/admin scope behind feature flags that default to off:
   - `VITE_ENABLE_ADVANCED_ADMIN=false`
   - `VITE_ENABLE_ADVANCED_CALLS=false`
3. Refactor architecture to isolate core behavior from advanced modules:
   - split monolithic store into slices
   - centralize Matrix SDK operations in adapters
   - decompose app shell orchestration into focused hooks/modules
   - isolate admin-heavy UI into feature module boundaries

## Consequences

### Positive

- Higher reliability for public/default usage because core flows stay simpler.
- Lower blast radius when adding advanced features.
- Clear onboarding path for self-hosted Matrix users without admin complexity by default.
- Better long-term maintainability from composable boundaries.

### Tradeoffs

- Feature-flag checks and module boundaries add upfront refactor work.
- Advanced workflows require explicit test coverage in both flag states.

## Expected Outcomes

- Smaller, more stable default client runtime.
- Predictable architecture that supports incremental changes.
- Improved test stability and build confidence for public adoption.
