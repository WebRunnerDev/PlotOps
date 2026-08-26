import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("task quick-add chips seam", () => {
    it("exposes Type, Priority, Assignee, and Labels chips", () => {
        const chips = readFileSync(
            path.join(dirname, "task-quick-add-chips.tsx"),
            "utf8"
        );

        expect(chips).toMatch(/data-task-quick-add-chips/);
        expect(chips).toMatch(/taskType\./);
        expect(chips).toMatch(/priority\./);
        expect(chips).toMatch(/fields\.memberNone/);
        expect(chips).toMatch(/fields\.labels/);
        expect(chips).not.toMatch(/allowCreate/);
    });
});
