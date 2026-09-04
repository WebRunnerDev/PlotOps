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
        expect(aboutSource).toMatch(/wrap-break-word|break-words/);
    });

    it("uses the shared PlotOps repo URL and MIT license on View on GitHub", () => {
        expect(aboutSource).toMatch(/PLOTOPS_GITHUB_URL/);
        expect(aboutSource).toMatch(/PLOTOPS_LICENSE/);
        expect(aboutSource).toMatch(/target="_blank"/);
        expect(aboutSource).not.toMatch(/https:\/\/github\.com\//);
    });

    it("renders a features grid from i18n keys", () => {
        expect(aboutSource).toMatch(/featuresTitle/);
        expect(aboutSource).toMatch(/FEATURES/);
        expect(aboutSource).toMatch(/features\.\$\{key\}\.title/);
        expect(aboutSource).toMatch(/features\.\$\{key\}\.body/);
    });

    it("has en+ru copy for blurb, features, stack, MIT mark, and GitHub action", () => {
        const en = JSON.parse(read("src/app/locales/about/en.json")) as {
            features: Record<string, { body: string; title: string }>;
            openSource: string;
            stack: string;
            viewOnGitHub: string;
        };
        const ru = JSON.parse(read("src/app/locales/about/ru.json")) as {
            features: Record<string, { body: string; title: string }>;
            openSource: string;
            stack: string;
            viewOnGitHub: string;
        };

        const keys = [
            "kanban",
            "git",
            "cicd",
            "sprints",
            "teams",
            "collaboration",
            "palette",
            "guest",
        ];

        for (const locale of [en, ru]) {
            expect(locale.openSource).toMatch(/\{\{license\}\}/);
            expect(locale.viewOnGitHub.length).toBeGreaterThan(0);
            expect(locale.stack.length).toBeGreaterThan(0);
            for (const key of keys) {
                expect(locale.features[key]?.title.length).toBeGreaterThan(0);
                expect(locale.features[key]?.body.length).toBeGreaterThan(0);
            }
        }
    });
});
