# Prefer skeletons for content loads; spinners only when skeletons do not fit

Full-page or section fetches that replace known layout (lists, boards, settings panels, drawers, tables) should show **skeletons** that mirror the eventual UI — not a centered spinner. Spinners (and other indeterminate loaders) are reserved for cases where a skeleton would mislead or cannot map to a stable shape.

## Decision

- **Default loading affordance = skeleton.** Use `@/shared/shadcn/ui/skeleton` (composed into feature/page loading placeholders) whenever the user is waiting on content whose final layout is known or can be approximated: Kanban columns/cards, project/team lists, settings sections, notification lists, backlog tables, Task drawer sections, etc.
- **Spinners only when skeletons are inappropriate**, for example:
    - **Inline / action pending** — button submit, mute toggle, redeem invite, “save” on a small control: the chrome stays; only the action is busy.
    - **Unknown or non-layout-shaped work** — upload in progress, streaming log attach, toast `loading`, auth boot before any shell exists.
    - **Tiny slots** — icon-sized chrome (bell, menu item) where a skeleton block would look like broken UI.
- Prefer **layout-preserving** placeholders over a blank void + spinner. If a route already has a shell (sidebar, header), skeleton the **content region**, not the whole app.
- Do not invent a second loading system: reuse `Skeleton` / existing composed loaders (e.g. board loading) and `Spinner` from shadcn. Avoid ad-hoc CSS pulse boxes or raw `Loader2` outside those primitives unless composing into a toast or similar.

## Rejected

- **Spinner-first for every fetch** — jumps layout, hides information architecture, and feels like a generic spinner farm instead of PlotOps’ dense Linear-like shell.
- **Skeleton for every busy state** — a pulsing bar inside a 32px button or over an indeterminate upload is noise; action-level `Spinner` (or disabled + spinner) is clearer.
- **Full-app blocking overlay for ordinary navigation** — route transitions should skeleton the destination content; reserve full-screen blockers for rare global gates (e.g. auth session resolution) where no content shell is safe to show yet.
