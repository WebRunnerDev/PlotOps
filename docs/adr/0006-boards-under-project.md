# Boards belong to Project, not Team

Multi-board and branch mapping live under Project. Each Task belongs to exactly one Board; `board_columns` and git mapping (Base branch, Allowed head patterns) are Board-scoped; Labels stay Project-scoped. Access is Team Role only (ADR 0017) — no per-board ACL in this slice. Empty Allowed patterns mean allow-all; mismatches warn soft, not hard-block. Default Board is named `Main`; URL is `/projects/$projectId/boards/$boardId` (no `/teams` prefix on Board routes).
