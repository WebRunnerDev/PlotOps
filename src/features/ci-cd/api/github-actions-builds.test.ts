import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";

import {
    mapWorkflowRunToBuild,
    splitLogLines,
    unzipJobLogs,
} from "@/features/ci-cd/api/github-actions-builds";

describe("mapWorkflowRunToBuild", () => {
    it("maps a completed successful run", () => {
        const build = mapWorkflowRunToBuild({
            conclusion: "success",
            created_at: "2026-07-24T09:10:01.000Z",
            display_title: "chore: bump board filters",
            head_branch: "main",
            head_sha: "a1b2c3d4e5f6",
            html_url: "https://github.com/org/repo/actions/runs/99",
            id: 99,
            name: "CI",
            path: ".github/workflows/ci.yml",
            status: "completed",
            updated_at: "2026-07-24T09:12:04.000Z",
        });

        expect(build).toMatchObject({
            branch: "main",
            commitMessage: "chore: bump board filters",
            commitSha: "a1b2c3d",
            htmlUrl: "https://github.com/org/repo/actions/runs/99",
            id: "99",
            status: "success",
            workflowName: "CI",
        });
        expect(build.finishedAt).toBe("2026-07-24T09:12:04.000Z");
    });

    it("maps an in-progress run without finishedAt", () => {
        const build = mapWorkflowRunToBuild({
            conclusion: undefined,
            created_at: "2026-07-24T10:00:00.000Z",
            display_title: "feat: login",
            head_branch: "feature/login",
            head_sha: "deadbeef",
            html_url: "https://github.com/org/repo/actions/runs/100",
            id: 100,
            name: "CI",
            path: ".github/workflows/ci.yml",
            status: "in_progress",
            updated_at: "2026-07-24T10:01:00.000Z",
        });

        expect(build.status).toBe("running");
        expect(build.finishedAt).toBeUndefined();
    });
});

describe("splitLogLines", () => {
    it("splits on newlines and drops a trailing empty line", () => {
        expect(splitLogLines("a\nb\n")).toEqual(["a", "b"]);
        expect(splitLogLines("a\r\nb")).toEqual(["a", "b"]);
        expect(splitLogLines("")).toEqual([]);
    });
});

describe("unzipJobLogs", () => {
    it("concatenates text entries from a zip", () => {
        const encoder = new TextEncoder();
        const zipped = zipSync({
            "0_test.txt": encoder.encode("line one\nline two\n"),
            "1_lint.txt": encoder.encode("lint ok\n"),
        });

        const text = unzipJobLogs(zipped);
        expect(text).toContain("line one");
        expect(text).toContain("lint ok");
    });
});
