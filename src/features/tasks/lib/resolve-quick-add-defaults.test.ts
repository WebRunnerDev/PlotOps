import { describe, expect, it } from "vitest";

import { DEFAULT_TASK_PRIORITY } from "@/features/tasks/model/constants";

import {
    quickAddFieldsFromDraft,
    resolveQuickAddDefaults,
} from "./resolve-quick-add-defaults";

describe("resolveQuickAddDefaults", () => {
    it("uses board default type, medium priority, and empty labels", () => {
        expect(
            resolveQuickAddDefaults({
                autoAssignToCreator: false,
                currentUserId: "user-1",
                defaultTaskType: "bug",
                teamPeopleCount: 1,
            })
        ).toEqual({
            assigneeId: null,
            labelIds: [],
            priority: DEFAULT_TASK_PRIORITY,
            type: "bug",
        });
    });

    it("preselects the current user when board auto-assigns on a solo team", () => {
        expect(
            resolveQuickAddDefaults({
                autoAssignToCreator: true,
                currentUserId: "user-1",
                defaultTaskType: "task",
                teamPeopleCount: 1,
            }).assigneeId
        ).toBe("user-1");
    });

    it("does not preselect assignee when the team is not solo", () => {
        expect(
            resolveQuickAddDefaults({
                autoAssignToCreator: true,
                currentUserId: "user-1",
                defaultTaskType: "feature",
                teamPeopleCount: 2,
            }).assigneeId
        ).toBeNull();
    });
});

describe("quickAddFieldsFromDraft", () => {
    const defaults = resolveQuickAddDefaults({
        autoAssignToCreator: false,
        currentUserId: "user-1",
        defaultTaskType: "task",
        teamPeopleCount: 1,
    });

    it("returns defaults for v1 drafts", () => {
        expect(
            quickAddFieldsFromDraft(
                { title: "Old", updatedAt: 1, v: 1 },
                defaults
            )
        ).toEqual(defaults);
    });

    it("restores explicit None / Unassigned / labels from v2", () => {
        expect(
            quickAddFieldsFromDraft(
                {
                    assigneeId: null,
                    labelIds: ["a"],
                    priority: null,
                    title: "Meta",
                    type: "bug",
                    updatedAt: 1,
                    v: 2,
                },
                defaults
            )
        ).toEqual({
            assigneeId: null,
            labelIds: ["a"],
            priority: null,
            type: "bug",
        });
    });
});
