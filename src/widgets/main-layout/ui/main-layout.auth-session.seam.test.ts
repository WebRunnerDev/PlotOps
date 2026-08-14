import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("MainLayout AuthSessionGuard seam", () => {
    it("mounts AuthSessionGuard so sibling navigations re-check Auth", () => {
        const source = readFileSync(
            path.join(dirname, "main-layout.tsx"),
            "utf8"
        );

        expect(source).toMatch(/AuthSessionGuard/);
    });
});
