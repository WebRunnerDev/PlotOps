import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, "../../../..");

function read(relativePath: string) {
    return readFileSync(path.join(root, relativePath), "utf8");
}

const panel = read("src/features/tasks/ui/task-github-panel.tsx");
const commits = read("src/features/tasks/ui/task-github-commits.tsx");

/** Every `<Button …>` / `<DropdownMenuTrigger …>` opening tag in a source file. */
function openingTags(source: string, tag: string) {
    return [
        ...source.matchAll(new RegExp(String.raw`<${tag}\b[\s\S]*?>`, "g")),
    ].map((match) => match[0]);
}

describe("TaskGithubPanel layout (#350)", () => {
    it("renders only linked Repositories — no always-open add form", () => {
        expect(panel).not.toMatch(/repositoriesWithoutGitLink/);
        expect(panel).not.toMatch(/github\.addGitLink/);
        expect(panel).toMatch(
            /flatMap\(\(\{ link, repository \}\) => \(link \? \[/
        );
        // Add forms open only from the "+ Link" menu.
        expect(panel).toMatch(/github\.attach"/);
        expect(panel).toMatch(/\{attach && canEdit \? \(/);
    });

    it("keeps secondary actions in a text menu, without Unlink icons", () => {
        expect(panel).not.toMatch(/\bUnlink\b(?! [a-z])/);
        expect(panel).toMatch(/github\.rowActions/);
        for (const key of [
            "github.unlinkBranch",
            "github.unlinkPr",
            "github.unlinkGitLink",
        ]) {
            expect(panel).toMatch(
                new RegExp(
                    String.raw`<DropdownMenuItem[\s\S]{0,240}>\s*\{t\("${key.replace(".", String.raw`\.`)}"`
                )
            );
        }
    });

    it("drops the no-PR badge texts and per-block PR target", () => {
        expect(panel).not.toMatch(/github\.noPr/);
        expect(panel).not.toMatch(/github\.noBaseBranch/);
        // PR target lives in the Open PR tooltip only.
        expect(panel.match(/github\.prTarget/g)).toHaveLength(1);
    });

    it("unlinks with an Undo toast restoring the previous Git link", () => {
        expect(panel).toMatch(/github\.unlinkedToast/);
        expect(panel).toMatch(
            /label: t\("github\.undo"\)[\s\S]{0,200}gitLinkRestoreChange\(previous\)/
        );
    });

    it("gives every icon button and menu trigger an accessible name", () => {
        for (const source of [panel, commits]) {
            for (const tag of openingTags(source, "Button")) {
                if (/size="icon-/.test(tag)) {
                    expect(tag).toMatch(/aria-label=/);
                }
            }
        }
        // The `⋯` trigger renders an icon-only Button.
        expect(panel).toMatch(
            /aria-label=\{t\("github\.rowActions"[\s\S]{0,400}size="icon-xs"/
        );
    });

    it("moves commits into a collapsible section with a one-line empty hint", () => {
        expect(panel).toMatch(/<TaskGithubCommits/);
        expect(commits).toMatch(/<Collapsible/);
        expect(commits).toMatch(/github\.commitsTitle/);
        expect(commits).toMatch(/github\.commitsEmpty/);
        expect(commits).toMatch(/showRepository/);
    });

    it("board locales drop the removed github keys and add the new ones", () => {
        for (const lang of ["en", "ru"]) {
            const github = (
                JSON.parse(read(`src/app/locales/board/${lang}.json`)) as {
                    github: Record<string, unknown>;
                }
            ).github;
            for (const removed of [
                "noPr",
                "noPrSkipped",
                "noPrTag",
                "noBaseBranch",
                "skipBranch",
                "addGitLink",
                "smartCommitsHint",
            ]) {
                expect(github).not.toHaveProperty(removed);
            }
            for (const added of [
                "attach",
                "rowActions",
                "unlinkedToast",
                "undo",
                "commitsTitle",
                "commitsEmpty",
            ]) {
                expect(github).toHaveProperty(added);
            }
        }
    });
});
