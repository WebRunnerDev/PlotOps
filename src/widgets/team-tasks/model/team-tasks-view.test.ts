import { describe, expect, it } from "vitest";

import type { TeamTask } from "@/features/tasks";

import {
    ANY_ASSIGNEE_FILTER,
    buildTeamTasksGroups,
    DEFAULT_TEAM_TASKS_PREFERENCES,
    filterTeamTasks,
    groupTeamTasks,
    ME_ASSIGNEE_FILTER,
    teamTaskDeadlineBucket,
    type TeamTasksPreferences,
    UNASSIGNED_ASSIGNEE_FILTER,
} from "./team-tasks-view";

const ME = { id: "me", name: "Mira" };
const ALEX = { id: "alex", name: "Alex" };

/** Wednesday 12 Aug 2026, local noon. */
const NOW = new Date(2026, 7, 12, 12);

function ids(tasks: TeamTask[]): string[] {
    return tasks.map((task) => task.id);
}

function preferences(
    overrides: Partial<TeamTasksPreferences> = {}
): TeamTasksPreferences {
    return { ...DEFAULT_TEAM_TASKS_PREFERENCES, ...overrides };
}

function teamTask(overrides: Partial<TeamTask> = {}): TeamTask {
    return {
        boardId: "board-core",
        boardName: "Core",
        createdAt: "2026-08-01T09:00:00.000Z",
        id: "task-1",
        isDone: false,
        key: "TASK-1",
        projectId: "project-a",
        projectName: "Apollo",
        status: "todo",
        statusName: "To do",
        title: "Task",
        type: "task",
        ...overrides,
    };
}

describe("Team Tasks defaults", () => {
    it('is "assigned to me, not Done, by Deadline, grouped by Project"', () => {
        expect(DEFAULT_TEAM_TASKS_PREFERENCES).toEqual({
            assignee: ME_ASSIGNEE_FILTER,
            groupBy: "project",
            hideDone: true,
            projectIds: [],
            sort: { direction: "asc", field: "deadline" },
        });
    });
});

describe("filterTeamTasks", () => {
    const tasks = [
        teamTask({ assignee: ME, id: "mine" }),
        teamTask({ assignee: ME, id: "mine-done", isDone: true }),
        teamTask({ assignee: ALEX, id: "alex", projectId: "project-b" }),
        teamTask({ id: "nobody" }),
    ];

    it("keeps the viewer's open Tasks by default", () => {
        expect(ids(filterTeamTasks(tasks, preferences(), "me"))).toEqual([
            "mine",
        ]);
    });

    it("matches nothing for Me without a signed-in viewer", () => {
        expect(filterTeamTasks(tasks, preferences())).toEqual([]);
    });

    it("shows Done Tasks when hide Done is off", () => {
        expect(
            ids(filterTeamTasks(tasks, preferences({ hideDone: false }), "me"))
        ).toEqual(["mine", "mine-done"]);
    });

    const open = (assignee: string) =>
        ids(filterTeamTasks(tasks, preferences({ assignee }), "me"));

    it("filters by Anyone, Unassigned, and a specific Assignee", () => {
        expect(open(ANY_ASSIGNEE_FILTER)).toEqual(["mine", "alex", "nobody"]);
        expect(open(UNASSIGNED_ASSIGNEE_FILTER)).toEqual(["nobody"]);
        expect(open("alex")).toEqual(["alex"]);
    });

    it("restricts to the selected Projects; empty means every Project", () => {
        const any = { assignee: ANY_ASSIGNEE_FILTER };

        expect(
            ids(
                filterTeamTasks(
                    tasks,
                    preferences({ ...any, projectIds: ["project-b"] }),
                    "me"
                )
            )
        ).toEqual(["alex"]);
        expect(
            filterTeamTasks(tasks, preferences({ ...any }), "me")
        ).toHaveLength(3);
    });
});

describe("teamTaskDeadlineBucket", () => {
    it("buckets by overdue / rolling week / later / none", () => {
        expect(teamTaskDeadlineBucket(undefined, NOW)).toBe("none");
        expect(teamTaskDeadlineBucket("2026-08-11", NOW)).toBe("overdue");
        expect(teamTaskDeadlineBucket("2026-08-12", NOW)).toBe("thisWeek");
        expect(teamTaskDeadlineBucket("2026-08-18", NOW)).toBe("thisWeek");
        expect(teamTaskDeadlineBucket("2026-08-19", NOW)).toBe("later");
    });
});

describe("groupTeamTasks", () => {
    it("returns one unlabelled group when grouping is off", () => {
        const tasks = [teamTask({ id: "a" }), teamTask({ id: "b" })];

        expect(groupTeamTasks(tasks, "none", NOW)).toEqual([
            { key: "all", kind: "none", tasks },
        ]);
        expect(groupTeamTasks([], "none", NOW)).toEqual([]);
    });

    it("groups by Project in name order, keeping the row order inside", () => {
        const groups = groupTeamTasks(
            [
                teamTask({
                    id: "z1",
                    projectId: "project-z",
                    projectName: "Zeus",
                }),
                teamTask({ id: "a1" }),
                teamTask({
                    id: "z2",
                    projectId: "project-z",
                    projectName: "Zeus",
                }),
            ],
            "project",
            NOW
        );

        expect(groups.map((group) => group.label)).toEqual(["Apollo", "Zeus"]);
        expect(ids(groups[1]!.tasks)).toEqual(["z1", "z2"]);
    });

    it("groups by Assignee with Unassigned last", () => {
        const groups = groupTeamTasks(
            [
                teamTask({ id: "nobody" }),
                teamTask({ assignee: ME, id: "mine" }),
                teamTask({ assignee: ALEX, id: "alex" }),
            ],
            "assignee",
            NOW
        );

        expect(groups.map((group) => group.key)).toEqual([
            "alex",
            "me",
            UNASSIGNED_ASSIGNEE_FILTER,
        ]);
        expect(groups.at(-1)?.label).toBeUndefined();
    });

    it("orders Deadline buckets overdue → this week → later → none", () => {
        const groups = groupTeamTasks(
            [
                teamTask({ id: "none" }),
                teamTask({ deadline: "2026-09-30", id: "later" }),
                teamTask({ deadline: "2026-08-14", id: "week" }),
                teamTask({ deadline: "2026-08-01", id: "overdue" }),
            ],
            "deadline",
            NOW
        );

        expect(groups.map((group) => group.key)).toEqual([
            "overdue",
            "thisWeek",
            "later",
            "none",
        ]);
    });
});

describe("buildTeamTasksGroups", () => {
    const tasks = [
        teamTask({
            assignee: ME,
            createdAt: "2026-08-03T09:00:00.000Z",
            id: "no-deadline",
            priority: "urgent",
        }),
        teamTask({
            assignee: ME,
            createdAt: "2026-08-02T09:00:00.000Z",
            deadline: "2026-08-20",
            id: "late",
            priority: "low",
        }),
        teamTask({
            assignee: ME,
            createdAt: "2026-08-01T09:00:00.000Z",
            deadline: "2026-08-13",
            id: "soon",
            priority: "high",
        }),
    ];
    const flat = (sort: TeamTasksPreferences["sort"]) =>
        ids(
            buildTeamTasksGroups(
                tasks,
                preferences({ groupBy: "none", sort }),
                {
                    currentUserId: "me",
                    now: NOW,
                }
            )[0]!.tasks
        );

    it("sorts by Deadline soonest first with empty Deadlines last", () => {
        expect(flat({ direction: "asc", field: "deadline" })).toEqual([
            "soon",
            "late",
            "no-deadline",
        ]);
    });

    it("sorts by Priority and by created date", () => {
        expect(flat({ direction: "desc", field: "priority" })).toEqual([
            "no-deadline",
            "soon",
            "late",
        ]);
        expect(flat({ direction: "desc", field: "created" })).toEqual([
            "no-deadline",
            "late",
            "soon",
        ]);
    });

    it("drops everything the filters hide", () => {
        expect(
            buildTeamTasksGroups(tasks, preferences(), {
                currentUserId: "someone-else",
                now: NOW,
            })
        ).toEqual([]);
    });
});
