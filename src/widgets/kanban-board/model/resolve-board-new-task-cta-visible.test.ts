import { describe, expect, it } from "vitest";

import { resolveBoardNewTaskCtaVisible } from "./resolve-board-new-task-cta-visible";

describe("resolveBoardNewTaskCtaVisible", () => {
    it.each([
        {
            canCreateTasks: true,
            expected: true,
            isSettled: true,
            label: "shown when access settled and can create tasks",
        },
        {
            canCreateTasks: false,
            expected: false,
            isSettled: true,
            label: "hidden without canCreateTasks",
        },
        {
            canCreateTasks: true,
            expected: false,
            isSettled: false,
            label: "hidden while access is unsettled",
        },
        {
            canCreateTasks: false,
            expected: false,
            isSettled: false,
            label: "hidden when unsettled and cannot create",
        },
    ])("$label", ({ canCreateTasks, expected, isSettled }) => {
        expect(
            resolveBoardNewTaskCtaVisible({ canCreateTasks, isSettled })
        ).toBe(expected);
    });
});
