import { beforeEach, describe, expect, it, vi } from "vitest";

const toastError = vi.fn();

vi.mock("sonner", () => ({
    toast: {
        error: (...arguments_: unknown[]) => toastError(...arguments_),
    },
}));

import { toastTaskDoneRefusal } from "./toast-task-done-refusal";

describe("toastTaskDoneRefusal", () => {
    beforeEach(() => {
        toastError.mockClear();
    });

    it("reuses a stable sonner id so dragOver cannot stack copies", () => {
        const translate = vi.fn((key: string) => key);

        toastTaskDoneRefusal(translate, "open_blocker");
        toastTaskDoneRefusal(translate, "open_blocker");

        expect(toastError).toHaveBeenCalledTimes(2);
        expect(toastError.mock.calls[0]?.[1]).toEqual({
            id: "task-done-refused:open_blocker",
        });
        expect(toastError.mock.calls[1]?.[1]).toEqual({
            id: "task-done-refused:open_blocker",
        });
    });
});
