# MMP-005 — Make customer payment instructions copyable and clear

- **Status:** Done
- **Priority / size:** P0 / XS
- **Outcome:** Customer can copy exact payment instructions and understand the destination-tag requirement.

## Acceptance criteria

- [x] One action copies amount, network, destination, destination tag, and optional reference.
- [x] Customer is explicitly warned that a missing or incorrect destination tag can prevent matching.
- [x] Copy action has accessible focus, button semantics, and success/error feedback.

## Evidence

Frontend typecheck, lint, and production build pass.
