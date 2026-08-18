import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("AuthProvider OAuth boot wait seam", () => {
    it("defers finishing boot while an OAuth callback has no session yet", () => {
        const source = fs.readFileSync(
            path.join(dirname, "auth-provider.tsx"),
            "utf8"
        );

        expect(source).toMatch(/shouldFinishAuthBoot/);
        expect(source).toMatch(/isOAuthCallbackLocation/);
        // Must not mark boot done on a null session during ?code= exchange.
        expect(source).toMatch(
            /shouldFinishAuthBoot\(\{[\s\S]*?isOAuthCallback[\s\S]*?session:/
        );
        expect(source).toMatch(/githubProviderTokenFromSession/);
    });
});
