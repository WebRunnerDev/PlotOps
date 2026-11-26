# Releasing PlotOps

Releases are automatic. Work flows feature → `dev` → `main`; each `dev` →
`main` merge that brings `feat`, `fix` or `perf` commits becomes a new version
a few minutes later — nobody approves or merges the release by hand.
Production still deploys on every push to `main`; a release gives that state a
version number, a tag and release notes.

## What you do

1. In a feature PR (into `dev`) that changes something users notice, add one
   JSON file to
   [`src/features/whats-new/upcoming/`](../src/features/whats-new/upcoming/README.md)
   with the change in English and Russian. It appears on the What's new page
   (`/whats-new`) when the release ships. PRs without user-facing changes
   (refactors, tests, CI) skip it.
2. Merge `dev` → `main` with **Create a merge commit**, not squash. A squash
   keeps only the PR title, so the `feat:` / `fix:` commits inside are lost
   and no release happens (unless that title is itself `feat: …` or `fix: …`).

That is the whole manual part.

## What happens after the merge into `main`

1. The `release-please` workflow opens a release PR named
   `chore(main): release X.Y.Z`. The version comes from the commit titles:
   `feat` → minor, `fix` / `perf` → patch, `feat!` or a `BREAKING CHANGE:`
   footer → major. `chore`, `docs`, `ci`, `test`, `refactor` alone do not
   release.
2. The same workflow moves the files from `upcoming/` into
   `src/features/whats-new/data/releases.json` under `X.Y.Z`, pushes that to
   the release PR and turns on auto-merge.
3. CI runs on the release PR. When the required checks pass, GitHub merges it.
4. That merge tags `vX.Y.Z`, publishes the GitHub Release (notes = the
   CHANGELOG section), and deploys. Signed-in users see a dot on their avatar
   until they open What's new.
5. The workflow opens a `main` → `dev` sync PR with auto-merge, so `dev`
   gets the new version and stamped notes back and does not drift behind
   `main`.

The same push to `main` runs the `edge-secrets` job (`supabase-migrate`
workflow): it compares the Edge Function secrets the code needs with
`supabase secrets list` and fails on a gap. It does not stop the deploy, but a
red job means a feature is off in prod: set the named secrets
(`docs/SUPABASE.md#edge-function-secrets`). Edge Functions themselves are still
deployed by hand.

If a bot PR's checks fail, it stays open: the release PR is retried on the
next merge to `main`; the sync PR needs a look (usually a conflict in `dev`).

## One-time setup

- Secret `RELEASE_PLEASE_TOKEN` in the GitHub environment `release`
  (deployment branches: `main` only), not at repository level: a fine-grained
  PAT for this repository with **Contents**, **Pull requests** and **Issues**
  set to read/write. It can reach `main` through the release PR, so the
  workflow never runs dependency code while the token is reachable
  (`npm ci --ignore-scripts`, no persisted checkout credentials). The
  default `GITHUB_TOKEN` is not enough: GitHub does not start CI for PRs it
  opens, so the release PR could never pass its checks and merge.
- Settings → General → Pull Requests → **Allow auto-merge**, and required
  status checks on `main` (repository ruleset). Without them auto-merge can't
  be enabled; the workflow then leaves a warning and a person merges the
  release PR.

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
