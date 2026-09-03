import { beforeEach, describe, expect, it } from "vitest";

import { useTasksUiStore } from "./use-tasks-ui-store";

describe("useTasksUiStore task swap", () => {
    beforeEach(() => {
        useTasksUiStore.setState({
            archiveDialogOpenRequestKey: 0,
            focusCommentId: undefined,
            selectedTaskId: undefined,
            taskSwapEpoch: 0,
            taskSwapFromId: undefined,
        });
    });

    it("records swap metadata when selecting another Task while one is open", () => {
        const { selectTask } = useTasksUiStore.getState();

        selectTask("parent");
        expect(useTasksUiStore.getState().taskSwapFromId).toBeUndefined();
        expect(useTasksUiStore.getState().taskSwapEpoch).toBe(0);

        selectTask("child");
        expect(useTasksUiStore.getState()).toMatchObject({
            selectedTaskId: "child",
            taskSwapEpoch: 1,
            taskSwapFromId: "parent",
        });
    });

    it("clears swap metadata when the drawer closes", () => {
        const { clearSelectedTask, selectTask } = useTasksUiStore.getState();

        selectTask("parent");
        selectTask("child");
        clearSelectedTask();

        expect(useTasksUiStore.getState()).toMatchObject({
            selectedTaskId: undefined,
            taskSwapEpoch: 0,
            taskSwapFromId: undefined,
        });
    });
});
