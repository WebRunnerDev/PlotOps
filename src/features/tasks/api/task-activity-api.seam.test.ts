import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("remote task Activity field allow-list seam", () => {
    it("keeps task_link changes from activity_log", () => {
        const source = readFileSync(
            path.join(dirname, "task-activity-api.ts"),
            "utf8"
        );

        expect(source).toMatch(/value === "task_link"/);
        expect(source).toMatch(/value === "subtask"/);
    });
});
