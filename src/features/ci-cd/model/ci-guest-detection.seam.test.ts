import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("CI/git Guest Mode detection seam", () => {
    it("CI hooks resolve Guest from guest-mode, not demo email/UUID", () => {
        const builds = readFileSync(
            path.join(dirname, "use-project-builds.ts"),
            "utf8"
        );
        const jobs = readFileSync(
            path.join(dirname, "use-build-jobs.ts"),
            "utf8"
        );
        const stream = readFileSync(
            path.join(dirname, "use-build-log-stream.ts"),
            "utf8"
        );

        for (const source of [builds, jobs, stream]) {
            expect(source).toMatch(/from "@\/features\/guest-mode"/);
            expect(source).toMatch(/isGuest\(\)/);
            expect(source).not.toMatch(/isGuestSession/);
        }
    });
});
