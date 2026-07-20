# Boards belong to Project, not Team

Multi-board and branch mapping live under Project — there is still no Team entity. Each Task belongs to exactly one Board; `board_columns` and git mapping (Base branch, Allowed head patterns) are Board-scoped; Labels stay Project-scoped. Access remains Project Role only (no per-board ACL in this slice). Empty Allowed patterns mean allow-all; mismatches warn soft, not hard-block. Default Board is named `Main`; URL is `/projects/$projectId/boards/$boardId`.
