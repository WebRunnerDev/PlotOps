import { expect, type Page, test } from "@playwright/test";

import { collectPageErrors, enterGuestDemo } from "./helpers/guest-watch";

/** Open a Task drawer from its Board card and return the GitHub block. */
async function openGithubPanel(page: Page, taskKey: string) {
    await page.getByRole("button", { exact: true, name: taskKey }).click();
    const panel = page.getByTestId("task-github-panel");
    await expect(panel).toBeVisible({ timeout: 30_000 });
    return panel;
}

test.describe("Task drawer GitHub block (#350)", () => {
    test("Task without Git links shows only the header, + Link and commits", async ({
        page,
    }) => {
        await enterGuestDemo(page);
        const panel = await openGithubPanel(page, "TASK-6");

        await expect(panel.getByText("GitHub", { exact: true })).toBeVisible();
        await expect(
            panel.getByRole("button", { exact: true, name: "Link" })
        ).toBeVisible();
        await expect(panel.getByTestId("github-git-link")).toHaveCount(0);
        await expect(panel.getByTestId("github-attach-form")).toHaveCount(0);
    });

    test("two Git links render two rows of the same structure and no add form", async ({
        page,
    }) => {
        const errors = collectPageErrors(page);
        await enterGuestDemo(page);
        const panel = await openGithubPanel(page, "FEAT-2");

        const rows = panel.getByTestId("github-git-link");
        await expect(rows).toHaveCount(2);
        await expect(panel.getByTestId("github-attach-form")).toHaveCount(0);

        for (const [repository, pr] of [
            ["plotops-demo/web", "PR #43"],
            ["plotops-demo/api", "PR #17"],
        ] as const) {
            const row = panel.getByRole("region", { name: repository });
            await expect(row.locator("code")).toHaveText(
                "feature/FEAT-2-guest-ci-mock"
            );
            await expect(row.getByRole("link", { name: pr })).toBeVisible();
            await expect(
                row.getByRole("button", { name: `${repository} actions` })
            ).toBeVisible();
        }
        expect(errors).toEqual([]);
    });

    test("Undo in the unlink toast restores the branch and the PR", async ({
        page,
    }) => {
        await enterGuestDemo(page);
        const panel = await openGithubPanel(page, "FEAT-2");
        const api = panel.getByRole("region", { name: "plotops-demo/api" });

        await api
            .getByRole("button", { name: "plotops-demo/api actions" })
            .click();
        await page.getByRole("menuitem", { name: "Unlink repository" }).click();

        await expect(panel.getByTestId("github-git-link")).toHaveCount(1);
        await expect(api).toHaveCount(0);

        await page.getByRole("button", { exact: true, name: "Undo" }).click();

        await expect(panel.getByTestId("github-git-link")).toHaveCount(2);
        await expect(api.locator("code")).toHaveText(
            "feature/FEAT-2-guest-ci-mock"
        );
        await expect(api.getByRole("link", { name: "PR #17" })).toBeVisible();
    });

    test("every interactive element of the block has an accessible name", async ({
        page,
    }) => {
        await enterGuestDemo(page);
        const panel = await openGithubPanel(page, "FEAT-2");
        await expect(panel.getByTestId("github-git-link")).toHaveCount(2);

        const controls = panel.locator(
            "button, a[href], input, [role=combobox]"
        );
        const count = await controls.count();
        expect(count).toBeGreaterThan(0);
        for (let index = 0; index < count; index += 1) {
            await expect(controls.nth(index)).toHaveAccessibleName(/\S/);
        }
    });
});
