import { useEffect, useState } from "react";

import type {
    BuildJob,
    BuildLogLine,
    BuildsRepository,
    BuildStatus,
} from "@/features/ci-cd/model/types";

import { resolveBuildsProvider } from "@/features/ci-cd/api/resolve-builds-provider";
import { isGuest } from "@/features/guest-mode";

const IN_FLIGHT_POLL_MS = 5000;

export function isInFlightStatus(status: BuildStatus | undefined): boolean {
    return status === "queued" || status === "running";
}

/**
 * Progressive log lines of one job of a run (Actions or mock provider).
 * Unsubscribes on close / job switch (no full page reload).
 * While the job is still queued/running, restarts the stream after each pass
 * so logs appear without closing the dialog. Later passes replace lines only
 * when the new stream finishes (avoids wiping usable output every poll).
 */
export function useJobLogStream(
    repository: BuildsRepository | undefined,
    job: BuildJob | undefined
): { isStreaming: boolean; lines: BuildLogLine[] } {
    const guest = isGuest();
    const provider = resolveBuildsProvider(guest);
    const [lines, setLines] = useState<BuildLogLine[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    // Primitive deps: a jobs refetch hands over new objects for the same job.
    const jobId = job?.id;
    const jobName = job?.name ?? "";
    const jobStatus = job?.status;

    useEffect(() => {
        if (!jobId || !jobStatus || !repository) {
            setLines([]);
            setIsStreaming(false);
            return;
        }

        const current: BuildJob = {
            id: jobId,
            name: jobName,
            status: jobStatus,
        };
        let cancelled = false;
        let stopCurrent: (() => void) | undefined;
        let pollTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
        let pass = 0;

        const clearPoll = () => {
            if (pollTimer !== undefined) {
                globalThis.clearTimeout(pollTimer);
                pollTimer = undefined;
            }
        };

        const start = () => {
            if (cancelled) return;
            clearPoll();
            stopCurrent?.();
            pass += 1;
            const isFirstPass = pass === 1;
            const buffer: BuildLogLine[] = [];
            let flushQueued = false;

            if (isFirstPass) {
                setLines([]);
            }
            setIsStreaming(true);

            stopCurrent = provider.streamJobLogs(
                repository,
                current,
                (line) => {
                    if (cancelled) return;
                    if (line.text.length > 0) {
                        buffer.push(line);
                    }
                    // Providers emit a batch of lines per tick: copy the
                    // buffer into state once per batch, not once per line.
                    if (isFirstPass && !flushQueued && !line.done) {
                        flushQueued = true;
                        queueMicrotask(() => {
                            flushQueued = false;
                            if (!cancelled) setLines([...buffer]);
                        });
                    }
                    if (!line.done) return;

                    setLines([...buffer]);
                    setIsStreaming(false);
                    if (isInFlightStatus(jobStatus) && !cancelled) {
                        pollTimer = globalThis.setTimeout(
                            start,
                            IN_FLIGHT_POLL_MS
                        );
                    }
                }
            );
        };

        start();

        return () => {
            cancelled = true;
            clearPoll();
            stopCurrent?.();
            setIsStreaming(false);
        };
    }, [jobId, jobName, jobStatus, provider, repository]);

    return { isStreaming, lines };
}
