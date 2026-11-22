# Upcoming What's new notes

Notes for the next release, waiting to ship. A PR that changes something users
notice adds one JSON file here (any name, e.g. `task-peek.json`). One file per
PR, so parallel PRs never conflict.

```json
{
    "changes": [
        {
            "kind": "new",
            "en": "Task Peek opens a Task without leaving the page.",
            "ru": "Быстрый просмотр открывает задачу, не уводя со страницы."
        }
    ]
}
```

- `kind`: `new`, `improved` or `fixed`.
- `en` and `ru` are both required: one sentence each, in product terms (Task,
  Board, Sprint — see `CONTEXT.md`), about what a person can now do.
- Optional `title` and `summary` (`{ "en": …, "ru": … }`) name a big release;
  without them the page titles the release by its version.

On release, the bot moves every file here into
`../data/releases.json` under the new version and deletes them. Process:
`docs/RELEASING.md`.
