import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("git-data Guest Mode detection seam", () => {
    it("routes fixtures from Guest Mode detection, not demo email/UUID", () => {
        const source = readFileSync(
            path.join(dirname, "use-git-data.ts"),
            "utf8"
        );

        expect(source).toMatch(/from "@\/features\/guest-mode"/);
        expect(source).toMatch(/isGuest\(\)/);
        expect(source).not.toMatch(/isGuestSession/);
    });
});
