import { describe, expect, it } from "vitest";

import { extractTaskKeysFromText } from "../../../supabase/functions/_shared/task-key.ts";
import { taskGitNaming } from "./git-naming.ts";

describe("taskGitNaming", () => {
    it("builds a feat branch, commit example and PR title from the task", () => {
        expect(
            taskGitNaming({
                task_key: "WEB-12",
                task_type: "story",
                title: "Login form: email + password",
            })
        ).toEqual({
            branch: "feat/WEB-12-login-form-email-password",
            commit_example: "feat: <what changed> (WEB-12)",
            hint: expect.stringContaining("WEB-12"),
            pr_title: "WEB-12: Login form: email + password",
            task_key: "WEB-12",
        });
    });

    it("uses fix/ for bugs", () => {
        const naming = taskGitNaming({
            task_key: "WEB-7",
            task_type: "bug",
            title: "Crash on save",
        });
        expect(naming.branch).toBe("fix/WEB-7-crash-on-save");
        expect(naming.commit_example).toBe("fix: <what changed> (WEB-7)");
    });

    it("falls back to the bare key when the title has no ASCII words", () => {
        const naming = taskGitNaming({
            task_key: "WEB-3",
            task_type: "task",
            title: "Форма входа",
        });
        expect(naming.branch).toBe("feat/WEB-3");
        expect(naming.pr_title).toBe("WEB-3: Форма входа");
    });

    it("cuts long slugs on a word boundary", () => {
        const naming = taskGitNaming({
            task_key: "WEB-1",
            title: "Allow members to export every board as a CSV file with filters",
        });
        const slug = naming.branch.replace("feat/WEB-1-", "");
        expect(slug.length).toBeLessThanOrEqual(40);
        expect(slug).toBe("allow-members-to-export-every-board-as-a");
    });

    it("produces names the webhook matcher links back to the task", () => {
        const naming = taskGitNaming({
            task_key: "WEB-12",
            title: "Login 2 factor, fix web 5",
        });
        expect(naming.branch).toBe("feat/WEB-12-login2-factor-fix-web5");
        for (const text of [
            naming.branch,
            naming.commit_example,
            naming.pr_title,
        ]) {
            expect(extractTaskKeysFromText(text)).toEqual(["WEB-12"]);
        }
    });
});
