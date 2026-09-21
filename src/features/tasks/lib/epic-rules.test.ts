import { describe, expect, it } from "vitest";

import {
    applyEpicRules,
    convertToEpicRefusal,
    effectiveEpicId,
    EPIC_RULE_ERROR,
    epicRefusalFromError,
    EpicRuleError,
    type EpicRuleTask,
    summarizeProjectEpics,
} from "./epic-rules";

function node(id: string, overrides: Partial<EpicRuleTask> = {}): EpicRuleTask {
    return { id, projectId: "p1", type: "task", ...overrides };
}

const epic = node("epic", { epicColor: "teal", type: "epic" });
const story = node("story", { type: "story" });
const parent = node("parent");
const child = node("child", { parentId: "parent" });
const tasks = [epic, story, parent, child];

function refusal(run: () => unknown) {
    try {
        run();
    } catch (error) {
        return epicRefusalFromError(error);
    }
    return null;
}

describe("applyEpicRules", () => {
    it("lets a root Story join an Epic in the same Project", () => {
        const next = applyEpicRules(
            story,
            { ...story, epicId: "epic" },
            tasks,
            {
                canManage: false,
            }
        );
        expect(next.epicId).toBe("epic");
    });

    it("refuses targets that are not live Epics of the Project", () => {
        const options = { canManage: true };
        expect(
            refusal(() =>
                applyEpicRules(
                    story,
                    { ...story, epicId: "parent" },
                    tasks,
                    options
                )
            )
        ).toBe("not_an_epic");
        expect(
            refusal(() =>
                applyEpicRules(
                    story,
                    { ...story, epicId: "missing" },
                    tasks,
                    options
                )
            )
        ).toBe("epic_missing");
        expect(
            refusal(() =>
                applyEpicRules(
                    story,
                    { ...story, epicId: "other" },
                    [
                        ...tasks,
                        node("other", { projectId: "p2", type: "epic" }),
                    ],
                    options
                )
            )
        ).toBe("different_project");
        expect(
            refusal(() =>
                applyEpicRules(
                    story,
                    { ...story, epicId: "old" },
                    [...tasks, node("old", { archivedAt: "x", type: "epic" })],
                    options
                )
            )
        ).toBe("archived_epic");
    });

    it("keeps Epics out of Sprints, Parents, and other Epics", () => {
        const options = { canManage: true };
        expect(
            refusal(() =>
                applyEpicRules(
                    epic,
                    { ...epic, sprintId: "s1" },
                    tasks,
                    options
                )
            )
        ).toBe("epic_in_sprint");
        expect(
            refusal(() =>
                applyEpicRules(
                    epic,
                    { ...epic, epicId: "epic2" },
                    tasks,
                    options
                )
            )
        ).toBe("epic_in_epic");
        expect(
            refusal(() =>
                applyEpicRules(
                    undefined,
                    node("new", { parentId: "epic" }),
                    tasks,
                    options
                )
            )
        ).toBe("epic_subtasks");
    });

    it("clears Estimate on Epics and colour on everything else", () => {
        const promoted = applyEpicRules(
            story,
            { ...story, estimate: 5, type: "epic" },
            tasks,
            { canManage: true }
        );
        expect(promoted.estimate).toBeUndefined();

        const demoted = applyEpicRules(
            node("lonely", { epicColor: "red", type: "epic" }),
            node("lonely", { epicColor: "red", type: "task" }),
            tasks,
            { canManage: true }
        );
        expect(demoted.epicColor).toBeUndefined();
    });

    it("drops a promoted Story's own Epic instead of refusing", () => {
        const inEpic = { ...story, epicId: "epic" };
        const next = applyEpicRules(
            inEpic,
            { ...inEpic, type: "epic" },
            tasks,
            {
                canManage: true,
            }
        );
        expect(next.epicId).toBeUndefined();
    });

    it("gates Epic conversion on Manager+ and on membership", () => {
        expect(
            refusal(() =>
                applyEpicRules(story, { ...story, type: "epic" }, tasks, {
                    canManage: false,
                })
            )
        ).toBe("manager_only");
        expect(
            refusal(() =>
                applyEpicRules(
                    epic,
                    { ...epic, type: "task" },
                    [...tasks, { ...story, epicId: "epic" }],
                    { canManage: true }
                )
            )
        ).toBe("epic_has_members");
        expect(
            refusal(() =>
                applyEpicRules(parent, { ...parent, type: "epic" }, tasks, {
                    canManage: true,
                })
            )
        ).toBe("parent_becomes_epic");
    });

    it("moves Epic membership to the Parent when a Task becomes a Subtask", () => {
        const inEpic = { ...story, epicId: "epic" };
        const next = applyEpicRules(
            inEpic,
            { ...inEpic, parentId: "parent" },
            tasks,
            { canManage: false }
        );
        expect(next.epicId).toBeUndefined();

        expect(
            refusal(() =>
                applyEpicRules(child, { ...child, epicId: "epic" }, tasks, {
                    canManage: true,
                })
            )
        ).toBe("subtask_epic");
    });
});

describe("convertToEpicRefusal", () => {
    it("names the blocker the viewer can fix", () => {
        expect(convertToEpicRefusal(story, tasks)).toBeNull();
        expect(convertToEpicRefusal(child, tasks)).toBe("epic_is_subtask");
        expect(convertToEpicRefusal(parent, tasks)).toBe("parent_becomes_epic");
        expect(convertToEpicRefusal({ ...story, sprintId: "s1" }, tasks)).toBe(
            "epic_in_sprint"
        );
    });
});

describe("epicRefusalFromError", () => {
    it("recognises server (PostgREST) and Guest errors by message", () => {
        expect(
            epicRefusalFromError({
                code: "P0001",
                message: EPIC_RULE_ERROR.epic_in_sprint,
            })
        ).toBe("epic_in_sprint");
        expect(epicRefusalFromError(new EpicRuleError("manager_only"))).toBe(
            "manager_only"
        );
        expect(epicRefusalFromError(new Error("boom"))).toBeNull();
    });
});

describe("effectiveEpicId", () => {
    it("prefers the Task's own Epic, else its Parent's", () => {
        expect(effectiveEpicId({ epicId: "a" })).toBe("a");
        expect(effectiveEpicId({ parentEpicId: "b" })).toBe("b");
        expect(effectiveEpicId({})).toBeUndefined();
    });
});

describe("summarizeProjectEpics", () => {
    it("rolls up live members — count, Done, and points", () => {
        const base = {
            boardId: "b1",
            createdAt: "2026-09-01T00:00:00.000Z",
            status: "todo",
            title: "t",
        };
        const summary = summarizeProjectEpics(
            [
                { ...base, ...epic, key: "EPIC-1" },
                {
                    ...base,
                    ...node("s1", { epicId: "epic", estimate: 3 }),
                    key: "S-1",
                    status: "done",
                },
                {
                    ...base,
                    ...node("s2", { epicId: "epic", estimate: 5 }),
                    key: "S-2",
                },
                { ...base, ...node("s3", { epicId: "epic" }), key: "S-3" },
                {
                    ...base,
                    ...node("gone", {
                        archivedAt: "x",
                        epicId: "epic",
                        estimate: 8,
                    }),
                    key: "S-4",
                },
            ],
            "p1",
            (_boardId, status) => status === "done"
        );
        expect(summary).toEqual([
            expect.objectContaining({
                color: "teal",
                doneCount: 1,
                id: "epic",
                pointsDone: 3,
                pointsTotal: 8,
                taskCount: 3,
                unestimatedCount: 1,
            }),
        ]);
    });
});
