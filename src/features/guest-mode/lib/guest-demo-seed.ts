import type { GuestPerson, GuestSandbox } from "../model/types";

/** Fixed demo actor — chrome identity only; not a Supabase user. */
export const GUEST_SEED_ACTOR_ID =
    "a0000000-0000-4000-8000-000000000001" as const;

const ACTOR: GuestPerson = {
    id: GUEST_SEED_ACTOR_ID,
    name: "Demo Guest",
};

const TEAM_ID = "b0000000-0000-4000-8000-000000000001";
/** Seeded Git-linked Project — Try demo lands on this Board. */
export const GUEST_DEMO_PROJECT_ID =
    "b0000000-0000-4000-8000-000000000010" as const;
/** Seeded Board for the Git-linked demo Project. */
export const GUEST_DEMO_BOARD_ID =
    "b0000000-0000-4000-8000-000000000012" as const;
const PROJ_GIT_ID = GUEST_DEMO_PROJECT_ID;
const PROJ_PLAIN_ID = "b0000000-0000-4000-8000-000000000011";
const BOARD_GIT_ID = GUEST_DEMO_BOARD_ID;
const BOARD_PLAIN_ID = "b0000000-0000-4000-8000-000000000013";
const SPRINT_ACTIVE_ID = "b0000000-0000-4000-8000-000000000020";
const SPRINT_DRAFT_ID = "b0000000-0000-4000-8000-000000000021";

const LABEL_FRONTEND = "b0000000-0000-4000-8000-000000000030";
const LABEL_BACKEND = "b0000000-0000-4000-8000-000000000031";
const LABEL_CI = "b0000000-0000-4000-8000-000000000032";
const LABEL_DOCS = "b0000000-0000-4000-8000-000000000033";
const LABEL_DESIGN = "b0000000-0000-4000-8000-000000000034";

const T01 = "b0000000-0000-4000-8000-000000000101";
const T02 = "b0000000-0000-4000-8000-000000000102";
const T03 = "b0000000-0000-4000-8000-000000000103";
const T04 = "b0000000-0000-4000-8000-000000000104";
const T05 = "b0000000-0000-4000-8000-000000000105";
const T06 = "b0000000-0000-4000-8000-000000000106";
const T07 = "b0000000-0000-4000-8000-000000000107";
const T08 = "b0000000-0000-4000-8000-000000000108";
const T09 = "b0000000-0000-4000-8000-000000000109";
const T10 = "b0000000-0000-4000-8000-000000000110";
const T11 = "b0000000-0000-4000-8000-000000000111";
const T12 = "b0000000-0000-4000-8000-000000000112";
const T13 = "b0000000-0000-4000-8000-000000000113";
const T14 = "b0000000-0000-4000-8000-000000000114";
const T15 = "b0000000-0000-4000-8000-000000000115";

const DEFAULT_COLUMNS = [
    { id: "todo", name: "To Do", position: 0 },
    { id: "in_progress", name: "In Progress", position: 1 },
    { id: "in_review", name: "In Review", position: 2 },
    { id: "done", name: "Done", position: 3 },
] as const;

/**
 * Canonical product Guest seed (TS). Not remote SQL / shared demo account.
 * Clone via {@link cloneGuestDemoSeed} — do not mutate this object in place.
 */
export const GUEST_DEMO_SEED: GuestSandbox = {
    activity: [
        {
            action: "updated",
            createdAt: "2026-08-03T10:00:00.000Z",
            id: "c0000000-0000-4000-8000-000000000201",
            metadata: {
                changes: [
                    {
                        field: "status",
                        from: { name: "To Do" },
                        to: { name: "In Progress" },
                    },
                ],
            },
            projectId: PROJ_GIT_ID,
            taskId: T01,
            user: ACTOR,
        },
        {
            action: "updated",
            createdAt: "2026-08-04T10:00:00.000Z",
            id: "c0000000-0000-4000-8000-000000000202",
            metadata: {
                changes: [
                    {
                        field: "priority",
                        from: "high",
                        to: "urgent",
                    },
                ],
            },
            projectId: PROJ_GIT_ID,
            taskId: T02,
            user: ACTOR,
        },
        {
            action: "updated",
            createdAt: "2026-08-04T14:00:00.000Z",
            id: "c0000000-0000-4000-8000-000000000203",
            metadata: {
                changes: [
                    {
                        field: "pr",
                        from: null,
                        to: { number: 41, state: "open" },
                    },
                ],
            },
            projectId: PROJ_GIT_ID,
            taskId: T03,
            user: ACTOR,
        },
        {
            action: "updated",
            createdAt: "2026-08-01T10:00:00.000Z",
            id: "c0000000-0000-4000-8000-000000000204",
            metadata: {
                changes: [
                    {
                        field: "status",
                        from: { name: "In Review" },
                        to: { name: "Done" },
                    },
                ],
            },
            projectId: PROJ_GIT_ID,
            taskId: T04,
            user: ACTOR,
        },
        {
            action: "updated",
            createdAt: "2026-07-30T10:00:00.000Z",
            id: "c0000000-0000-4000-8000-000000000205",
            metadata: {
                changes: [
                    {
                        field: "assignee",
                        from: null,
                        to: { name: "Demo Guest" },
                    },
                ],
            },
            projectId: PROJ_GIT_ID,
            taskId: T11,
            user: ACTOR,
        },
        {
            action: "updated",
            createdAt: "2026-08-04T22:00:00.000Z",
            id: "c0000000-0000-4000-8000-000000000206",
            metadata: {
                changes: [
                    {
                        field: "status",
                        from: { name: "In Progress" },
                        to: { name: "In Review" },
                    },
                ],
            },
            projectId: PROJ_PLAIN_ID,
            taskId: T15,
            user: ACTOR,
        },
    ],
    boards: [
        {
            allowedHeadPatterns: ["feature/*", "fix/*", "bugfix/*"],
            baseBranch: "main",
            columns: [...DEFAULT_COLUMNS],
            id: BOARD_GIT_ID,
            name: "Board",
            position: 0,
            projectId: PROJ_GIT_ID,
        },
        {
            allowedHeadPatterns: [],
            baseBranch: "main",
            columns: [...DEFAULT_COLUMNS],
            id: BOARD_PLAIN_ID,
            name: "Board",
            position: 0,
            projectId: PROJ_PLAIN_ID,
        },
    ],
    comments: [
        {
            author: ACTOR,
            body: "<p>Landing the CTA on the existing sign-in secondary slot — no OAuth needed.</p>",
            createdAt: "2026-08-03T11:30:00.000Z",
            id: "e0000000-0000-4000-8000-000000000401",
            projectId: PROJ_GIT_ID,
            taskId: T01,
            updatedAt: "2026-08-03T11:30:00.000Z",
        },
        {
            author: ACTOR,
            body: "<p>Fixtures look good on the CI tab — retry once to see the stream animation.</p>",
            createdAt: "2026-08-04T12:00:00.000Z",
            id: "e0000000-0000-4000-8000-000000000402",
            projectId: PROJ_GIT_ID,
            taskId: T02,
            updatedAt: "2026-08-04T12:00:00.000Z",
        },
        {
            author: ACTOR,
            body: "<p>Seed cards cover To Do → Done so the board looks populated on first open.</p>",
            createdAt: "2026-08-04T15:00:00.000Z",
            id: "e0000000-0000-4000-8000-000000000403",
            projectId: PROJ_GIT_ID,
            taskId: T03,
            updatedAt: "2026-08-04T15:00:00.000Z",
        },
    ],
    labels: [
        {
            color: "blue",
            id: LABEL_FRONTEND,
            name: "frontend",
            projectId: PROJ_GIT_ID,
        },
        {
            color: "purple",
            id: LABEL_BACKEND,
            name: "backend",
            projectId: PROJ_GIT_ID,
        },
        { color: "orange", id: LABEL_CI, name: "ci", projectId: PROJ_GIT_ID },
        {
            color: "gray",
            id: LABEL_DOCS,
            name: "docs",
            projectId: PROJ_GIT_ID,
        },
        {
            color: "pink",
            id: LABEL_DESIGN,
            name: "design",
            projectId: PROJ_PLAIN_ID,
        },
    ],
    notifications: [
        {
            createdAt: "2026-08-04T10:00:00.000Z",
            id: "d0000000-0000-4000-8000-000000000301",
            kind: "assignment",
            metadata: {
                actor: { id: GUEST_SEED_ACTOR_ID, name: "Demo Guest" },
            },
            projectId: PROJ_GIT_ID,
            readAt: null,
            taskId: T02,
            taskKey: "FEAT-2",
            taskTitle: "Mock CI builds for guest session",
        },
        {
            createdAt: "2026-08-03T10:00:00.000Z",
            id: "d0000000-0000-4000-8000-000000000302",
            kind: "status_change",
            metadata: {
                actor: { id: GUEST_SEED_ACTOR_ID, name: "Demo Guest" },
                from: "todo",
                to: "in_progress",
            },
            projectId: PROJ_GIT_ID,
            readAt: "2026-08-04T14:00:00.000Z",
            taskId: T01,
            taskKey: "FEAT-1",
            taskTitle: "Wire guest sign-in CTA",
        },
        {
            createdAt: "2026-08-02T10:00:00.000Z",
            id: "d0000000-0000-4000-8000-000000000303",
            kind: "priority_change",
            metadata: {
                actor: { id: GUEST_SEED_ACTOR_ID, name: "Demo Guest" },
                from: "low",
                to: "medium",
            },
            projectId: PROJ_GIT_ID,
            readAt: null,
            taskId: T11,
            taskKey: "BUG-11",
            taskTitle: "Flaky board Realtime reconnect",
        },
    ],
    projects: [
        {
            createdAt: "2026-07-16T10:00:00.000Z",
            description:
                "Seeded demo project with fake GitHub fields for Git/CI UI.",
            githubDefaultBranch: "main",
            githubFullName: "plotops-demo/plotops",
            githubHtmlUrl: "https://github.com/plotops-demo/plotops",
            githubRepoId: 999_000_001,
            id: PROJ_GIT_ID,
            isPrivate: false,
            name: "PlotOps Demo",
            slug: "plotops-demo",
            teamId: TEAM_ID,
            updatedAt: "2026-08-04T10:00:00.000Z",
        },
        {
            createdAt: "2026-07-18T10:00:00.000Z",
            description: "Second project without a linked GitHub repo.",
            githubDefaultBranch: "main",
            githubFullName: null,
            githubHtmlUrl: null,
            githubRepoId: null,
            id: PROJ_PLAIN_ID,
            isPrivate: false,
            name: "Marketing Site",
            slug: "marketing-site",
            teamId: TEAM_ID,
            updatedAt: "2026-08-02T10:00:00.000Z",
        },
    ],
    sprints: [
        {
            boardId: BOARD_GIT_ID,
            committedTaskIds: [T01, T02, T03, T04, T05, T06],
            completedTaskIds: [],
            createdAt: "2026-07-26T10:00:00.000Z",
            endsOn: "2026-08-15",
            goal: "Ship a convincing Guest Mode walkthrough for portfolio reviewers.",
            id: SPRINT_ACTIVE_ID,
            name: "Sprint 14 — Demo Launch",
            projectId: PROJ_GIT_ID,
            startedAt: "2026-08-02T10:00:00.000Z",
            startsOn: "2026-08-02",
            state: "active",
        },
        {
            boardId: BOARD_GIT_ID,
            committedTaskIds: [],
            completedTaskIds: [],
            createdAt: "2026-08-03T10:00:00.000Z",
            goal: "Follow-ups after the demo launch.",
            id: SPRINT_DRAFT_ID,
            name: "Sprint 15 — Polish",
            projectId: PROJ_GIT_ID,
            state: "draft",
        },
    ],
    tasks: [
        {
            assignee: ACTOR,
            author: ACTOR,
            boardId: BOARD_GIT_ID,
            branchName: "feature/TASK-1-guest-signin-cta",
            deadline: "2026-08-07",
            description:
                "<p>Primary secondary button on sign-in that starts a Guest Session.</p>",
            id: T01,
            key: "FEAT-1",
            labelIds: [LABEL_FRONTEND],
            position: 0,
            pr: {
                number: 42,
                state: "open",
                url: "https://github.com/plotops-demo/plotops/pull/42",
            },
            priority: "high",
            projectId: PROJ_GIT_ID,
            sprintId: SPRINT_ACTIVE_ID,
            sprintPosition: 0,
            status: "in_progress",
            title: "Wire guest sign-in CTA",
            type: "feature",
        },
        {
            assignee: ACTOR,
            author: ACTOR,
            boardId: BOARD_GIT_ID,
            branchName: "feature/FEAT-2-guest-ci-mock",
            deadline: "2026-08-06",
            description:
                "<p>Route guest sessions through the canned builds provider — no GitHub token.</p>",
            id: T02,
            key: "FEAT-2",
            labelIds: [LABEL_CI, LABEL_BACKEND],
            position: 1,
            pr: {
                number: 43,
                state: "open",
                url: "https://github.com/plotops-demo/plotops/pull/43",
            },
            priority: "urgent",
            projectId: PROJ_GIT_ID,
            sprintId: SPRINT_ACTIVE_ID,
            sprintPosition: 1,
            status: "in_progress",
            title: "Mock CI builds for guest session",
            type: "feature",
        },
        {
            assignee: ACTOR,
            author: ACTOR,
            boardId: BOARD_GIT_ID,
            branchName: "feature/TASK-3-guest-seed-dataset",
            deadline: "2026-08-05",
            description:
                "<p>Populate the Guest Mode seed with a Team, two Projects, and about 15 colourful tasks.</p>",
            id: T03,
            key: "TASK-3",
            labelIds: [LABEL_BACKEND],
            position: 0,
            pr: {
                number: 41,
                state: "open",
                url: "https://github.com/plotops-demo/plotops/pull/41",
            },
            priority: "high",
            projectId: PROJ_GIT_ID,
            sprintId: SPRINT_ACTIVE_ID,
            sprintPosition: 2,
            status: "in_review",
            title: "Seed demo kanban cards",
            type: "task",
        },
        {
            assignee: ACTOR,
            author: ACTOR,
            boardId: BOARD_GIT_ID,
            branchName: "feature/TASK-4-is-guest-session",
            deadline: "2026-08-01",
            description:
                "<p>Guest detection is a Guest Session client flag — not a demo email/UUID.</p>",
            id: T04,
            key: "FEAT-4",
            labelIds: [LABEL_FRONTEND],
            position: 0,
            pr: {
                number: 38,
                state: "merged",
                url: "https://github.com/plotops-demo/plotops/pull/38",
            },
            priority: "medium",
            projectId: PROJ_GIT_ID,
            sprintId: SPRINT_ACTIVE_ID,
            sprintPosition: 3,
            status: "done",
            title: "Guest Session detection",
            type: "feature",
        },
        {
            assignee: ACTOR,
            author: ACTOR,
            boardId: BOARD_GIT_ID,
            branchName: "docs/TASK-5-guest-creds-docs",
            deadline: "2026-07-31",
            description:
                "<p>Document Local Guest Mode and that Docker SQL seed is for RLS experiments only.</p>",
            id: T05,
            key: "TASK-5",
            labelIds: [LABEL_DOCS],
            position: 1,
            pr: {
                number: 37,
                state: "merged",
                url: "https://github.com/plotops-demo/plotops/pull/37",
            },
            priority: "low",
            projectId: PROJ_GIT_ID,
            sprintId: SPRINT_ACTIVE_ID,
            sprintPosition: 4,
            status: "done",
            title: "Document local Guest Mode",
            type: "task",
        },
        {
            assignee: ACTOR,
            author: ACTOR,
            boardId: BOARD_GIT_ID,
            deadline: "2026-08-10",
            description:
                "<p>Show a Demo chip so reviewers know they are in Guest Mode.</p>",
            id: T06,
            key: "TASK-6",
            position: 0,
            priority: "medium",
            projectId: PROJ_GIT_ID,
            sprintId: SPRINT_ACTIVE_ID,
            sprintPosition: 5,
            status: "todo",
            title: "Demo account chip in TopBar",
            type: "task",
        },
        {
            author: ACTOR,
            boardId: BOARD_GIT_ID,
            description:
                "<p>Keep Search / Switch Project / Theme; Create Task stays local-only.</p>",
            id: T07,
            key: "TASK-7",
            position: 1,
            priority: "medium",
            projectId: PROJ_GIT_ID,
            sprintId: SPRINT_DRAFT_ID,
            sprintPosition: 0,
            status: "todo",
            title: "Narrow command palette for guests",
            type: "task",
        },
        {
            author: ACTOR,
            boardId: BOARD_GIT_ID,
            description:
                "<p>Hide or no-op dangerous mutations that do not apply locally.</p>",
            id: T08,
            key: "TASK-8",
            position: 2,
            priority: "low",
            projectId: PROJ_GIT_ID,
            sprintId: SPRINT_DRAFT_ID,
            sprintPosition: 1,
            status: "todo",
            title: "Guard delete Team in guest mode",
            type: "task",
        },
        {
            assignee: ACTOR,
            author: ACTOR,
            boardId: BOARD_GIT_ID,
            branchName: "feature/FEAT-9-git-fixtures",
            deadline: "2026-08-12",
            description:
                "<p>Git tab should return canned commits/PRs when Guest has no provider token.</p>",
            id: T09,
            key: "FEAT-9",
            labelIds: [LABEL_FRONTEND],
            position: 3,
            priority: "high",
            projectId: PROJ_GIT_ID,
            status: "todo",
            title: "Fixture commits and PR diffs",
            type: "feature",
        },
        {
            author: ACTOR,
            boardId: BOARD_GIT_ID,
            description:
                "<p>Replay canned CI log lines so the CI tab looks alive without Actions.</p>",
            id: T10,
            key: "FEAT-10",
            labelIds: [LABEL_CI],
            position: 4,
            priority: "medium",
            projectId: PROJ_GIT_ID,
            status: "todo",
            title: "Streaming fake build logs",
            type: "feature",
        },
        {
            assignee: ACTOR,
            author: ACTOR,
            boardId: BOARD_GIT_ID,
            branchName: "fix/BUG-11-realtime-reconnect",
            deadline: "2026-08-08",
            description:
                "<p>Reproduce drop under slow 3G and harden the subscription bounce.</p>",
            id: T11,
            key: "BUG-11",
            labelIds: [LABEL_BACKEND],
            position: 2,
            pr: {
                number: 39,
                state: "open",
                url: "https://github.com/plotops-demo/plotops/pull/39",
            },
            priority: "medium",
            projectId: PROJ_GIT_ID,
            status: "in_progress",
            title: "Flaky board Realtime reconnect",
            type: "bug",
        },
        {
            assignee: ACTOR,
            author: ACTOR,
            boardId: BOARD_GIT_ID,
            deadline: "2026-07-28",
            description:
                "<p>Short paragraph pointing employers at Guest Mode from the README.</p>",
            id: T12,
            key: "TASK-12",
            labelIds: [LABEL_DOCS],
            position: 2,
            priority: "low",
            projectId: PROJ_GIT_ID,
            status: "done",
            title: "README portfolio tour",
            type: "task",
        },
        {
            assignee: ACTOR,
            author: ACTOR,
            boardId: BOARD_PLAIN_ID,
            deadline: "2026-08-14",
            description:
                "<p>Sharper headline for the marketing site without binding a GitHub repo.</p>",
            id: T13,
            key: "TASK-13",
            labelIds: [LABEL_DESIGN],
            position: 0,
            priority: "medium",
            projectId: PROJ_PLAIN_ID,
            status: "todo",
            title: "Landing hero copy refresh",
            type: "task",
        },
        {
            assignee: ACTOR,
            author: ACTOR,
            boardId: BOARD_PLAIN_ID,
            description:
                "<p>Collect logos and screenshots for outbound press notes.</p>",
            id: T14,
            key: "TASK-14",
            position: 0,
            priority: "low",
            projectId: PROJ_PLAIN_ID,
            status: "in_progress",
            title: "Press kit asset list",
            type: "task",
        },
        {
            assignee: ACTOR,
            author: ACTOR,
            boardId: BOARD_PLAIN_ID,
            deadline: "2026-08-06",
            description:
                "<p>Accordion fails to expand below the sm breakpoint.</p>",
            id: T15,
            key: "BUG-15",
            labelIds: [LABEL_DESIGN],
            position: 0,
            priority: "high",
            projectId: PROJ_PLAIN_ID,
            status: "in_review",
            title: "Broken FAQ accordion on mobile",
            type: "bug",
        },
    ],
    teams: [
        {
            createdAt: "2026-07-15T10:00:00.000Z",
            id: TEAM_ID,
            name: "PlotOps Demo Team",
            ownerId: GUEST_SEED_ACTOR_ID,
            updatedAt: "2026-08-03T10:00:00.000Z",
        },
    ],
};

/** Deep-clone the canonical seed for a new or reset Guest Session sandbox. */
export function cloneGuestDemoSeed(): GuestSandbox {
    return structuredClone(GUEST_DEMO_SEED);
}
