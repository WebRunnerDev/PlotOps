import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("AppRouter toaster seam", () => {
    it("mounts Toaster so toast.error/success are visible", () => {
        const source = fs.readFileSync(
            path.join(dirname, "app-router.tsx"),
            "utf8"
        );

        expect(source).toMatch(
            /import\s+\{\s*Toaster\s*\}\s+from\s+"@\/shared\/shadcn\/ui\/sonner"/
        );
        expect(source).toMatch(/<Toaster\s*\/>/);
    });
});
