import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BuildJob } from "@/features/ci-cd/model/types";

import { mockBuildsForProject } from "@/features/ci-cd/api/mock-builds";

const REPOSITORY = {
    defaultBranch: "main",
    fullName: "org/repo",
    id: "repo-1",
};

const API_REPOSITORY = {
    defaultBranch: "develop",
    fullName: "org/api",
    id: "repo-2",
};

const job = (id: string, status: BuildJob["status"]): BuildJob => ({
    id,
    name: id,
    status,
});

function collect(
    repository: typeof REPOSITORY,
    jobToStream: BuildJob
): { done: () => boolean; lines: string[]; stop: () => void } {
    const lines: string[] = [];
    let done = false;
    const stop = mockBuildsForProject.streamJobLogs(
        repository,
        jobToStream,
        (line) => {
            if (line.text.length > 0) lines.push(line.text);
            if (line.done) done = true;
        }
    );
    return { done: () => done, lines, stop };
}

describe("CI/CD builds-for-Project seam — streamJobLogs", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("emits progressive log lines for a known job without a network call", () => {
        const { lines, stop } = collect(REPOSITORY, job("job-3", "failure"));

        expect(lines).toEqual([]);

        vi.advanceTimersByTime(50);
        expect(lines.length).toBe(1);
        expect(lines[0]).toMatch(/checkout|install|test|fail|error|run/i);

        vi.advanceTimersByTime(50);
        expect(lines.length).toBe(2);
        expect(lines[1]).not.toBe(lines[0]);

        vi.advanceTimersByTime(10_000);
        expect(lines.length).toBeGreaterThanOrEqual(4);
        expect(lines.at(-1)).toMatch(/fail|error|exit/i);

        stop();
    });

    it("gives each job of a run its own log", () => {
        const test = collect(REPOSITORY, job("job-3", "failure"));
        const lint = collect(REPOSITORY, job("job-4", "success"));

        vi.advanceTimersByTime(10_000);
        expect(test.lines.join("\n")).toMatch(/npm run test/);
        expect(test.lines.join("\n")).not.toMatch(/npm run lint/);
        expect(lint.lines.join("\n")).toMatch(/npm run lint/);
        expect(lint.lines.join("\n")).not.toMatch(/npm run test/);

        test.stop();
        lint.stop();
    });

    it("marks the final line with done: true", () => {
        const received: { done: boolean; text: string }[] = [];

        const stop = mockBuildsForProject.streamJobLogs(
            REPOSITORY,
            job("job-6", "queued"),
            (line) => {
                received.push({ done: line.done, text: line.text });
            }
        );

        vi.advanceTimersByTime(500);
        expect(received.length).toBe(2);
        expect(received[0]?.done).toBe(false);
        expect(received[1]?.done).toBe(true);

        stop();
    });

    it("stops emitting after unsubscribe", () => {
        const { lines, stop } = collect(REPOSITORY, job("job-1", "success"));

        vi.advanceTimersByTime(50);
        const countAfterFirst = lines.length;
        expect(countAfterFirst).toBe(1);

        stop();
        vi.advanceTimersByTime(500);
        expect(lines.length).toBe(countAfterFirst);
    });

    it("completes with an empty stream for an unknown job id", () => {
        const { done, lines, stop } = collect(
            REPOSITORY,
            job("job-missing", "success")
        );

        vi.advanceTimersByTime(0);
        expect(lines).toEqual([]);
        expect(done()).toBe(true);
        stop();
    });

    it("reads a job's log only from the Repository its run belongs to", () => {
        const own = collect(API_REPOSITORY, job("job-api-5", "failure"));
        const other = collect(REPOSITORY, job("job-api-5", "failure"));

        vi.advanceTimersByTime(10_000);
        expect(own.lines.join("\n")).toMatch(/not ok 4/);
        expect(other.lines).toEqual([]);
        expect(other.done()).toBe(true);

        own.stop();
        other.stop();
    });
});
