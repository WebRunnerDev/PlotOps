# Releasing PlotOps

Releases are automatic. Every `feat`, `fix` or `perf` merged into `main`
becomes a new version a few minutes later — nobody approves or merges anything
by hand. Production still deploys on every push to `main`; a release gives
that state a version number, a tag and release notes.

## What you do

In a PR that changes something users notice, add one JSON file to
[`src/features/whats-new/upcoming/`](../src/features/whats-new/upcoming/README.md)
with the change in English and Russian. That text appears on the What's new
page (`/whats-new`) when the release ships. PRs without user-facing changes
(refactors, tests, CI) skip it.

That is the whole manual part.

## What happens after the merge

1. The `release-please` workflow opens a release PR named
   `chore(main): release X.Y.Z`. The version comes from the commit titles:
   `feat` → minor,
   `fix` / `perf` → patch, `feat!` or a `BREAKING CHANGE:` footer → major.
   `chore`, `docs`, `ci`, `test`, `refactor` alone do not release.
2. The same workflow moves the files from `upcoming/` into
   `src/features/whats-new/data/releases.json` under `X.Y.Z`, pushes that to
   the release PR and turns on auto-merge.
3. CI runs on the release PR. When the required checks pass, GitHub merges it.
4. That merge tags `vX.Y.Z`, publishes the GitHub Release (notes = the
   CHANGELOG section), and deploys. Signed-in users see a dot on their avatar
   until they open What's new.

If the release PR's checks fail, it stays open and is retried on the next
merge to `main`.

## One-time setup

- Secret `RELEASE_PLEASE_TOKEN`: a fine-grained PAT for this repository with
  **Contents**, **Pull requests** and **Issues** set to read/write. The
  default `GITHUB_TOKEN` is not enough: GitHub does not start CI for PRs it
  opens, so the release PR could never pass its checks and merge.
- Settings → General → Pull Requests → **Allow auto-merge**.

## Files

| File                                        | Written by               |
| ------------------------------------------- | ------------------------ |
| `src/features/whats-new/upcoming/*.json`    | you, in the feature PR   |
| `src/features/whats-new/data/releases.json` | the release workflow     |
| `CHANGELOG.md`                              | release-please           |
| `package.json`, `app-version.ts`, manifest  | release-please (version) |

## History

- `v1.0.0` (2026-09-02) was tagged by hand; its notes are in
  `docs/releases/v1.0.0.md`. Automation continues from that tag.
- Work before 1.0 has no versions; the What's new page tells it as periods.
