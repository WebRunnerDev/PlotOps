import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("BacklogPage refetch error seam", () => {
    it("does not treat sprint/board refetch errors as project denial", () => {
        const source = readFileSync(
            path.join(dirname, "backlog-page.tsx"),
            "utf8"
        );

        expect(source).toMatch(/sprintsData === undefined/);
        expect(source).toMatch(/columnsReady/);
        expect(source).toMatch(/tasksReady/);
        expect(source).not.toMatch(
            /columnsApi\.error\s*\?\?\s*tasksApi\.error\s*\?\?\s*sprintsError/
        );
        expect(source).toMatch(/boardLoadFailed/);
    });
});
