# Agent notes

## Agent skills

### Feature audit

Personal (User) Cursor skill — lives with your other agent skills:

- Skill: `~/.agents/skills/feature-audit/`
- Command: `/audit <path>` → `~/.cursor/commands/audit.md`

Delivers via GitHub Issues (`gh`), not local files. Copy that skill folder to
other PCs (or Settings Sync) to use at home.

### Issue tracker

GitHub Issues via `gh` (WebRunnerDev/PlotOps). See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical roles map 1:1 to tracker labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.
