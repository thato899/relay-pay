# MMP-001 — Create workspace foundation and quality pipeline

- **Status:** Done
- **Priority / size:** P0 / M
- **Outcome:** A new contributor can install, understand, typecheck, lint, and build the modular project.

## Acceptance criteria

- [x] TypeScript workspace separates web, API, and shared contracts.
- [x] `agent.md`, `planning.md`, and `status.md` define contribution and delivery context.
- [x] CI runs lint, typecheck, production build, dependency audit, and container builds.
- [x] Security workflows include CodeQL and pull-request dependency review.
- [x] Production dependency audit passes with no known vulnerabilities.

## Evidence

Local frozen install, lint, typecheck, production build, and dependency audit completed successfully. Docker image build remains independently tracked in MMP-006 because the local Docker engine is unavailable.
