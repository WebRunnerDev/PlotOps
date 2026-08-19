import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, "../../..");

function read(relativePath: string) {
    return readFileSync(path.join(root, relativePath), "utf8");
}

const aboutSource = read("src/routes/(main)/about.tsx");

describe("about page seam", () => {
    it("prevents long copy from forcing horizontal overflow", () => {
        expect(aboutSource).toMatch(/min-w-0/);
        expect(aboutSource).toMatch(/break-words/);
    });

    it("uses the shared PlotOps repo URL and MIT license on View on GitHub", () => {
        expect(aboutSource).toMatch(/PLOTOPS_GITHUB_URL/);
        expect(aboutSource).toMatch(/PLOTOPS_LICENSE/);
        expect(aboutSource).toMatch(/target="_blank"/);
        expect(aboutSource).not.toMatch(/https:\/\/github\.com\//);
    });

    it("has en+ru copy for the product blurb, MIT mark, and GitHub action", () => {
        const en = read("src/app/locales/about/en.json");
        const ru = read("src/app/locales/about/ru.json");

        for (const source of [en, ru]) {
            expect(source).toMatch(/"openSource"/);
            expect(source).toMatch(/\{\{license\}\}/);
            expect(source).toMatch(/"viewOnGitHub"/);
        }
    });
});
