import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("AuthProvider boot remount seam", () => {
    it("re-enters loading when the boot effect remounts after clearing bootError", () => {
        const source = fs.readFileSync(
            path.join(dirname, "auth-provider.tsx"),
            "utf8"
        );

        const effectBody = source.match(
            /useEffect\(\(\)\s*=>\s*\{([\s\S]*?)\},\s*\[applySessionUser/
        )?.[1];

        expect(effectBody).toBeDefined();
        // Remount used to setBootError(false) while isLoading stayed false —
        // AppRouter then flashed the boot-error screen into the app shell
        // (or ran queries before the new boot finished).
        expect(effectBody).toMatch(
            /setBootError\(false\);\s*setIsLoading\(true\)/
        );
    });
});
