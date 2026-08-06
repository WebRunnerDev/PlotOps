import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("guest sprints provider seam", () => {
    it("never imports Supabase from the Guest Sprint adapter", () => {
        const source = readFileSync(
            path.join(dirname, "guest-sprints-provider.ts"),
            "utf8"
        );

        expect(source).not.toMatch(/@\/shared\/api\/supabase/);
        expect(source).not.toMatch(/from ["']@supabase\//);
        expect(source).not.toMatch(/\.channel\(/);
        expect(source).not.toMatch(/\.rpc\(/);
    });

    it("hooks resolve Sprint providers from Guest Mode detection", () => {
        const hooks = readFileSync(
            path.join(dirname, "../model/use-sprints.ts"),
            "utf8"
        );

        expect(hooks).toMatch(/resolveSprintsProvider\(isGuest\(\)\)/);
        expect(hooks).toMatch(/from "@\/features\/guest-mode"/);
        expect(hooks).not.toMatch(
            /from "@\/features\/sprints\/api\/sprints-api"/
        );
        expect(hooks).not.toMatch(/isGuestSession/);
    });
});
