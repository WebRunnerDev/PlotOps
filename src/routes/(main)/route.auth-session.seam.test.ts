import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("Main app route live Auth session gate", () => {
    it("re-validates Auth with requireAuthSession before allowing chrome", () => {
        const source = readFileSync(path.join(dirname, "route.tsx"), "utf8");

        expect(source).toMatch(/requireAuthSession/);
        expect(source).toMatch(/redirect-sign-in/);
        expect(source).toMatch(/getUser/);
    });
});
