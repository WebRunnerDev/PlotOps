import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("Main app route Guest Session gate", () => {
    it("allows Auth XOR Guest Session and skips complete-profile for Guest", () => {
        const source = readFileSync(path.join(dirname, "route.tsx"), "utf8");

        expect(source).toMatch(/hasMainAppAccess/);
        expect(source).toMatch(/isGuest\(\)/);
        expect(source).toMatch(/isProfileGateRequired/);
        expect(source).not.toMatch(/isGuestSession/);
    });
});
