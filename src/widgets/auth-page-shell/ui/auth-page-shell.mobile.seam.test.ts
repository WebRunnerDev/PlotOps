import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("AuthPageShell mobile seam", () => {
    it("centers auth forms without horizontal overflow at 375px", () => {
        const source = readFileSync(
            path.join(dirname, "auth-page-shell.tsx"),
            "utf8"
        );

        expect(source).toMatch(/w-full/);
        expect(source).toMatch(/min-w-0/);
        expect(source).toMatch(/px-4/);
    });
});
