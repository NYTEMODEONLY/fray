# Lessons

- Always test logout/login cycles, not only first-login flows, before declaring auth integration healthy.
- For Matrix + Docker deployments, add structured diagnostics and log rotation during initial setup, not after incidents.
- For chat UX phases, validate visual familiarity (layout/control placement) and profile basics (avatar/display identity) before treating a phase as complete.
- Keep message composer and call controls out of each other's flow; voice/video UI should not occupy primary typing space in text channels.
- Replace production UI glyphs with a consistent icon library early; avoid emoji/text-symbol placeholders because they skew alignment and perceived quality.
- Avoid dead-click toast loops: disable unavailable controls with clear affordance instead of allowing repeat no-op clicks.
