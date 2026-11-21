import { useEffect, useRef, useState } from "react";

import type {
    BuildJob,
    BuildLogLine,
    BuildsRepository,
    BuildStatus,
} from "@/features/ci-cd/model/types";

import { resolveBuildsProvider } from "@/features/ci-cd/api/resolve-builds-provider";
import { isGuest } from "@/features/guest-mode";

const IN_FLIGHT_POLL_MS = 5000;

export type JobLogStream = {
    /** The job is queued/running: its log keeps refreshing while open. */
    isLive: boolean;
    /** The first download of this job's log has not finished yet. */
    isLoading: boolean;
    lines: BuildLogLine[];
};

export function isInFlightStatus(status: BuildStatus | undefined): boolean {
    return status === "queued" || status === "running";
}

/**
 * Log lines of one job of a run (Actions or mock provider).
 * A finished job's log arrives whole; a queued/running one streams in, then
 * restarts after each pass so new output appears without closing the dialog.
 * Later passes — and a status change of the same job — replace the lines only
 * when the new pass finishes, so the console never blanks out mid-read.
 * Unsubscribes on close / job switch.
 */
export function useJobLogStream(
    repository: BuildsRepository | undefined,
    job: BuildJob | undefined
): JobLogStream {
    const guest = isGuest();
    const provider = resolveBuildsProvider(guest);
    const [lines, setLines] = useState<BuildLogLine[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    // Which job the lines on screen belong to — kept across status changes.
    // Set once lines land, so an effect cancelled before that starts afresh.
    const shownJobReference = useRef<string | undefined>(undefined);
    // Primitive deps: a jobs refetch hands over new objects for the same job.
    const jobId = job?.id;
    const jobName = job?.name ?? "";
    const jobStatus = job?.status;

    useEffect(() => {
        if (!jobId || !jobStatus || !repository) {
            shownJobReference.current = undefined;
            setLines([]);
            setIsLoading(false);
            return;
        }

        const current: BuildJob = {
            id: jobId,
            name: jobName,
            status: jobStatus,
        };
        const sameJob = shownJobReference.current === jobId;
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
            // Only a fresh job fills the console as lines arrive.
            const progressive = isFirstPass && !sameJob;
            const buffer: BuildLogLine[] = [];
            let finished = false;
            let flushQueued = false;

            if (progressive) setLines([]);
            if (isFirstPass) setIsLoading(true);

            stopCurrent = provider.streamJobLogs(
                repository,
                current,
                (line) => {
                    if (cancelled || finished) return;
                    if (line.text.length > 0) buffer.push(line);

                    if (line.done) {
                        finished = true;
                        shownJobReference.current = jobId;
                        const next = [...buffer];
                        setLines((previous) =>
                            sameLog(previous, next) ? previous : next
                        );
                        if (isFirstPass) setIsLoading(false);
                        if (isInFlightStatus(jobStatus)) {
                            pollTimer = globalThis.setTimeout(
                                start,
                                IN_FLIGHT_POLL_MS
                            );
                        }
                        return;
                    }

                    // Providers emit a batch of lines per tick: copy the
                    // buffer into state once per batch, not once per line.
                    if (progressive && !flushQueued) {
                        flushQueued = true;
                        queueMicrotask(() => {
                            flushQueued = false;
                            if (cancelled || finished) return;
                            shownJobReference.current = jobId;
                            setLines([...buffer]);
                        });
                    }
                }
            );
        };

        start();

        return () => {
            cancelled = true;
            clearPoll();
            stopCurrent?.();
            setIsLoading(false);
        };
    }, [jobId, jobName, jobStatus, provider, repository]);

    return {
        isLive: Boolean(jobId) && isInFlightStatus(jobStatus),
        isLoading,
        lines,
    };
}

/** Same lines as already shown — skip the re-render of a big console. */
function sameLog(
    previous: readonly BuildLogLine[],
    next: readonly BuildLogLine[]
): boolean {
    if (previous.length !== next.length) return false;
    return previous.every((line, index) => line.text === next[index]?.text);
}
