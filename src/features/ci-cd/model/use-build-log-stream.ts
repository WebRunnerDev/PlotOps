import { useEffect, useState } from "react";

import type { BuildLogLine, BuildStatus } from "@/features/ci-cd/model/types";

import { resolveBuildsProvider } from "@/features/ci-cd/api/resolve-builds-provider";
import { isGuest } from "@/features/guest-mode";

const IN_FLIGHT_POLL_MS = 5000;

/**
 * Progressive log lines for a selected build (Actions or mock provider).
 * Unsubscribes on close / build change (no full page reload).
 * While the build is still queued/running, restarts the stream after each pass
 * so logs appear without closing the dialog. Later passes replace lines only
 * when the new stream finishes (avoids wiping usable output every poll).
 */
export function useBuildLogStream(
    projectId: string,
    buildId: string | undefined,
    buildStatus?: BuildStatus
): { isStreaming: boolean; lines: BuildLogLine[] } {
    const guest = isGuest();
    const provider = resolveBuildsProvider(guest);
    const [lines, setLines] = useState<BuildLogLine[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);

    useEffect(() => {
        if (!buildId) {
            setLines([]);
            setIsStreaming(false);
            return;
        }

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
            const thisPass = pass;
            const buffer: BuildLogLine[] = [];
            const isFirstPass = thisPass === 1;

            if (isFirstPass) {
                setLines([]);
            }
            setIsStreaming(true);

            stopCurrent = provider.streamBuildLogs(
                projectId,
                buildId,
                (line) => {
                    if (cancelled) return;
                    if (line.text.length > 0) {
                        if (isFirstPass) {
                            setLines((previous) => [...previous, line]);
                        } else {
                            buffer.push(line);
                        }
                    }
                    if (!line.done) return;

                    if (!isFirstPass) {
                        setLines(buffer);
                    }
                    setIsStreaming(false);
                    if (isInFlightStatus(buildStatus) && !cancelled) {
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
    }, [buildId, buildStatus, projectId, provider]);

    return { isStreaming, lines };
}

function isInFlightStatus(status: BuildStatus | undefined): boolean {
    return status === "queued" || status === "running";
}
