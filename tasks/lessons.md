# Lessons

- Always test logout/login cycles, not only first-login flows, before declaring auth integration healthy.
- For Matrix + Docker deployments, add structured diagnostics and log rotation during initial setup, not after incidents.
- For chat UX phases, validate visual familiarity (layout/control placement) and profile basics (avatar/display identity) before treating a phase as complete.
- Keep message composer and call controls out of each other's flow; voice/video UI should not occupy primary typing space in text channels.
- Replace production UI glyphs with a consistent icon library early; avoid emoji/text-symbol placeholders because they skew alignment and perceived quality.
- Avoid dead-click toast loops: disable unavailable controls with clear affordance instead of allowing repeat no-op clicks.
- For Discord-parity requests, verify real user flows in the exact target context (e.g., no-`m.space` servers) so features are not only implemented but reachable.
- Right-click menus with dynamic option counts must have bounded height + internal scroll; otherwise critical actions can become unreachable and appear "missing".
- For role systems, keep assignment controls in the same role-editing workflow (not hidden in a separate tab) to match user expectations and prevent “can create but can’t assign” confusion.
- Discord familiarity includes interaction entry points, not just data: clicking a member should open a profile/role card, and highest-role color should visibly propagate to names.
- Search UX must not produce implicit active results when query is empty; inactive search state should render zero result highlights to avoid random-looking pulses.
