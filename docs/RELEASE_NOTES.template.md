# Release notes template

Copy into GitHub → Releases → “Release notes”, or:

```bash
gh release create vX.Y.Z --title "vX.Y.Z — short theme" --notes-file docs/releases/vX.Y.Z.md
```

Replace placeholders. Delete empty sections.

---

## Title

`vX.Y.Z — <short theme>`

## Tag

`vX.Y.Z` (always prefix `v`)

## Body

```markdown
## Highlights

- One-line pitch for this release (why it exists).
- Second highlight if needed.

## What's Changed

### Added

- User-facing capability (not “refactored X”).

### Changed

- Behavior or UX change someone would notice.

### Fixed

- Bug that was broken, now isn’t — one concrete sentence.

### Breaking

- What breaks + what to do (migrations, env vars, renamed fields).

## Upgrade notes

- Supabase: migrations applied by CI on `main` (list migration theme if relevant).
- Env: new/changed `VITE_*` or Edge Function secrets.
- Guest / OAuth: anything operators must reconfigure.

## Full Changelog

https://github.com/WebRunnerDev/PlotOps/compare/vPREV...vX.Y.Z
```

## Checklist before publish

- [ ] Target commit is on `main` (or intentional release branch), CI green
- [ ] SemVer chosen: MAJOR / MINOR / PATCH (or pre-release `-beta.N`)
- [ ] Uncommitted / WIP not included
- [ ] Notes written for users, not for the git log
- [ ] “Latest release” only for stable; pre-releases marked as such
- [ ] `package.json` `version` bumped if you keep it in sync (optional for SPA)
