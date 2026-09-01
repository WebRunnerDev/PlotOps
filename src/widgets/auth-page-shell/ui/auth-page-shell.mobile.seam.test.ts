import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, "../../../..");

function read(relativePath: string) {
    return readFileSync(path.join(root, relativePath), "utf8");
}

describe("AuthPageShell mobile seam", () => {
    it("centers auth forms without horizontal overflow at 375px", () => {
        const source = read(
            "src/widgets/auth-page-shell/ui/auth-page-shell.tsx"
        );

        expect(source).toMatch(/w-full/);
        expect(source).toMatch(/min-w-0/);
        expect(source).toMatch(/px-4/);
        expect(source).toMatch(/flex-col/);
    });

    it("shows the open-source footer on the auth shell", () => {
        const shell = read(
            "src/widgets/auth-page-shell/ui/auth-page-shell.tsx"
        );
        const footer = read(
            "src/widgets/auth-page-shell/ui/auth-open-source-footer.tsx"
        );

        expect(shell).toMatch(/AuthOpenSourceFooter/);
        expect(footer).toMatch(/PLOTOPS_GITHUB_URL/);
        expect(footer).toMatch(/PLOTOPS_LICENSE/);
        expect(footer).toMatch(/LegalFooterLinks compact/);
        expect(footer).toMatch(/target="_blank"/);
        expect(footer).toMatch(/variant="link"/);
        expect(footer).toMatch(/min-w-0/);
        expect(footer).not.toMatch(/githubSignIn/);
    });

    it("has en+ru copy for the open-source footer", () => {
        const en = read("src/app/locales/auth/en.json");
        const ru = read("src/app/locales/auth/ru.json");

        for (const source of [en, ru]) {
            expect(source).toMatch(/"openSource"/);
            expect(source).toMatch(/"githubAria"/);
            expect(source).toMatch(/\{\{license\}\}/);
        }
    });
});
