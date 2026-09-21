-- Jira-like Task types (ADR 0031): `feature` becomes `story`, new `epic`.
-- Enum-only migration: a freshly added enum value cannot be used in the same
-- transaction, so every rule that references 'epic' lives in the next file.
-- Existing task_key values (FEAT-12) stay as they are — keys are immutable.

alter type public.task_type rename value 'feature' to 'story';

alter type public.task_type add value if not exists 'epic' before 'task';
