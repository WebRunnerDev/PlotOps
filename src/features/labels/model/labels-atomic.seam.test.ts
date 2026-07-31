import { QueryClient } from "@tanstack/react-query";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { taskKeys } from "@/features/tasks";

import { stripLabelIdFromTaskCaches } from "./invalidate-labels";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const projectId = "proj_1";
const boardId = "board_1";

describe("labels API atomic move seam", () => {
    it("moves via single move_project_label RPC", () => {
        const source = readFileSync(
            path.join(dirname, "../api/labels-api.ts"),
            "utf8"
        );

        expect(source).toMatch(/rpc\(\s*["']move_project_label["']/);
    });

    it("move mutation uses moveProjectLabel not create-then-delete", () => {
        const source = readFileSync(
            path.join(dirname, "use-project-labels.ts"),
            "utf8"
        );

        expect(source).toMatch(/moveLabelMutation[\s\S]*moveProjectLabel/);
        expect(source).not.toMatch(
            /moveLabelMutation[\s\S]*createProjectLabel[\s\S]*deleteProjectLabel/
        );
    });
});

describe("stripLabelIdFromTaskCaches", () => {
    it("removes the label id from board and project task caches", () => {
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        });

        const tasksKey = taskKeys.board(projectId, boardId);
        const projectTasksKey = taskKeys.project(projectId);

        queryClient.setQueryData(tasksKey, {
            taskPositions: new Map([["t1", 0]]),
            tasks: [
                {
                    id: "t1",
                    labelIds: ["keep", "gone"],
                    status: "todo",
                    title: "One",
                },
            ],
        });
        queryClient.setQueryData(projectTasksKey, [
            {
                id: "t2",
                labelIds: ["gone"],
                status: "todo",
                title: "Two",
            },
        ]);

        stripLabelIdFromTaskCaches(queryClient, projectId, "gone");

        expect(
            queryClient.getQueryData<{
                tasks: Array<{ labelIds?: string[] }>;
            }>(tasksKey)?.tasks[0]?.labelIds
        ).toEqual(["keep"]);
        expect(
            queryClient.getQueryData<Array<{ labelIds?: string[] }>>(
                projectTasksKey
            )?.[0]?.labelIds
        ).toBeUndefined();
    });
});
