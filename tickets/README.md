# Kanban tickets

`board.md` is the live status view. Each ticket is a small, reviewable unit of work with an owner outcome, acceptance criteria, and any dependencies or unblock conditions.

## Working rules

- Pull the highest-priority ticket in **Ready** when the WIP limit permits.
- Keep **In Progress** to one ticket. Move external waits to **Blocked** and write the exact unblock condition.
- Mark a ticket **Done** only when its acceptance criteria are met and relevant quality gates pass.
- When ticket status changes, update both the ticket file and `board.md`. Update `status.md` for meaningful milestones or blockers.
- Keep this board local and tool-independent; no tracker account is required.

## Priority and size

- **P0:** required for the hackathon demo or submission.
- **P1:** valuable after the core demo works.
- **P2:** future hardening or expansion.
- **XS / S / M / L:** relative effort only; split an L ticket before pulling it.

## Status meanings

| Status      | Meaning                                           |
| ----------- | ------------------------------------------------- |
| Backlog     | Agreed work, not yet pulled or fully prepared.    |
| Ready       | Clear, sized, and unblocked; can be pulled next.  |
| In Progress | The single active ticket being implemented.       |
| Blocked     | Waiting on a named external action or dependency. |
| Done        | Acceptance criteria are met and documented.       |
