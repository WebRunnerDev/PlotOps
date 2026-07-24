import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mockBuildsForProject } from "@/features/ci-cd/api/mock-builds";

describe("CI/CD builds-for-Project seam — streamBuildLogs", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("emits progressive log lines for a known build without a network call", () => {
        const lines: string[] = [];

        const stop = mockBuildsForProject.streamBuildLogs(
            "project-demo",
            "build-analytics-1",
            (line) => {
                lines.push(line.text);
            }
        );

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

    it("marks the final line with done: true", () => {
        const received: { done: boolean; text: string }[] = [];

        const stop = mockBuildsForProject.streamBuildLogs(
            "project-demo",
            "build-invite-1",
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
        const lines: string[] = [];

        const stop = mockBuildsForProject.streamBuildLogs(
            "project-demo",
            "build-main-1",
            (line) => {
                lines.push(line.text);
            }
        );

        vi.advanceTimersByTime(50);
        const countAfterFirst = lines.length;
        expect(countAfterFirst).toBe(1);

        stop();
        vi.advanceTimersByTime(500);
        expect(lines.length).toBe(countAfterFirst);
    });

    it("completes with an empty stream for an unknown build id", () => {
        const lines: string[] = [];
        let done = false;

        const stop = mockBuildsForProject.streamBuildLogs(
            "project-demo",
            "build-missing",
            (line) => {
                if (line.text.length > 0) {
                    lines.push(line.text);
                }
                if (line.done) {
                    done = true;
                }
            }
        );

        vi.advanceTimersByTime(0);
        expect(lines).toEqual([]);
        expect(done).toBe(true);
        stop();
    });
});
