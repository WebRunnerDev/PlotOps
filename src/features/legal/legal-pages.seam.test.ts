import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, "../../..");

function read(relativePath: string) {
    return readFileSync(path.join(root, relativePath), "utf8");
}

describe("legal pages seam", () => {
    it("exposes public /terms and /privacy routes", () => {
        expect(read("src/routes/terms.tsx")).toMatch(/documentId="terms"/);
        expect(read("src/routes/privacy.tsx")).toMatch(/documentId="privacy"/);
    });

    it("loads markdown from docs/legal without hard-coded prose", () => {
        const documents = read("src/features/legal/model/documents.ts");

        expect(documents).toMatch(/docs\/legal\/user-agreement-ru\.md\?raw/);
        expect(documents).toMatch(/docs\/legal\/user-agreement-en\.md\?raw/);
        expect(documents).toMatch(/docs\/legal\/privacy-policy-ru\.md\?raw/);
        expect(documents).toMatch(/docs\/legal\/privacy-policy-en\.md\?raw/);
        expect(documents).toMatch(/resolveLegalLocale/);
    });

    it("prevents long legal copy from forcing horizontal overflow", () => {
        const markdown = read("src/features/legal/ui/legal-markdown.tsx");
        const shell = read("src/features/legal/ui/legal-page-shell.tsx");

        expect(markdown).toMatch(/min-w-0/);
        expect(markdown).toMatch(/break-words/);
        expect(markdown).toMatch(/overflow-x-auto/);
        expect(shell).toMatch(/min-w-0/);
        expect(shell).toMatch(/max-w-3xl/);
    });

    it("links terms and privacy from the auth footer and about page", () => {
        const footer = read(
            "src/widgets/auth-page-shell/ui/auth-open-source-footer.tsx"
        );
        const about = read("src/routes/(main)/about.tsx");
        const links = read("src/features/legal/ui/legal-footer-links.tsx");

        expect(footer).toMatch(/LegalFooterLinks compact/);
        expect(footer).toMatch(/text-muted-foreground hover:text-foreground/);
        expect(about).toMatch(/LegalFooterLinks/);
        expect(links).toMatch(/to="\/terms"/);
        expect(links).toMatch(/to="\/privacy"/);
        expect(links).toMatch(/underline underline-offset-2/);
    });
});
