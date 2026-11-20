import { describe, expect, it } from "vitest";

import {
    jobLogFileName,
    jobLogText,
} from "@/features/ci-cd/model/job-log-export";

const build = {
    commitSha: "a1b2c3d",
    repositoryName: "WebRunnerDev/PlotOps",
    workflowName: "CI",
};

describe("jobLogText", () => {
    it("joins the lines with newlines and ends with one", () => {
        expect(
            jobLogText([
                { done: false, index: 0, text: "npm ci" },
                { done: false, index: 1, text: "  added 812 packages" },
                { done: true, index: 2, text: "Error: tests failed" },
            ])
        ).toBe("npm ci\n  added 812 packages\nError: tests failed\n");
    });

    it("is empty when there are no lines", () => {
        expect(jobLogText([])).toBe("");
    });
});

describe("jobLogFileName", () => {
    it("names the file after repo, workflow, job and commit", () => {
        expect(jobLogFileName(build, { name: "test (shard 2/4)" })).toBe(
            "plotops-ci-test-shard-2-4-a1b2c3d.log"
        );
    });

    it("keeps non-Latin letters", () => {
        expect(jobLogFileName(build, { name: "Сборка" })).toBe(
            "plotops-ci-сборка-a1b2c3d.log"
        );
    });

    it("falls back to job.log when nothing usable is left", () => {
        expect(
            jobLogFileName(
                { commitSha: "", repositoryName: "", workflowName: "///" },
                { name: "***" }
            )
        ).toBe("job.log");
    });
});
