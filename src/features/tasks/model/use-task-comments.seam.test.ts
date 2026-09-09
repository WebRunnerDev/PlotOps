import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("use-task-comments Comment Watcher seam", () => {
    const source = readFileSync(
        path.join(dirname, "use-task-comments.ts"),
        "utf8"
    );

    it("Comment create fans out Watcher comment via notifyCommentWatchersBestEffort", () => {
        expect(source).toMatch(/notifyCommentWatchersBestEffort/);
        const createFunction = source.match(
            /export function useCreateTaskComment[\s\S]*?^export function /m
        )?.[0];
        expect(createFunction).toBeDefined();
        expect(createFunction).toMatch(/notifyCommentWatchersBestEffort/);
        expect(createFunction).toMatch(/notifyNewMentionsBestEffort/);
    });

    it("Comment edit does not fan out Watcher comment", () => {
        const updateFunction = source.match(
            /export function useUpdateTaskComment[\s\S]*$/
        )?.[0];
        expect(updateFunction).toBeDefined();
        expect(updateFunction).toMatch(/notifyNewMentionsBestEffort/);
        expect(updateFunction).not.toMatch(/notifyCommentWatchersBestEffort/);
    });
});
