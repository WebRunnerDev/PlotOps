import { describe, expect, it } from "vitest";

import { callTool, ToolInputError } from "./tools.ts";

describe("tool input validation", () => {
    const context = {
        clientId: null,
        supabase: {} as never,
        user: { id: "user-1" } as never,
    };

    it("requires project_id or board_id for list_tasks", async () => {
        await expect(
            callTool("list_tasks", {}, context)
        ).rejects.toBeInstanceOf(ToolInputError);
    });

    it("rejects unknown tools", async () => {
        await expect(callTool("explode", {}, context)).rejects.toBeInstanceOf(
            ToolInputError
        );
    });

    it("requires a UUID board_id for create_task", async () => {
        await expect(
            callTool("create_task", { board_id: "nope", title: "Hi" }, context)
        ).rejects.toBeInstanceOf(ToolInputError);
    });

    it("does not accept author_id or PR fields on update_task", async () => {
        await expect(
            callTool(
                "update_task",
                {
                    author_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
                    task_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
                },
                context
            )
        ).rejects.toBeInstanceOf(ToolInputError);
    });
});
