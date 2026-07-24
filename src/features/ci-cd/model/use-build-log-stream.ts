import { useEffect, useState } from "react";

import type { BuildLogLine } from "@/features/ci-cd/model/types";

import { buildsProvider } from "@/features/ci-cd/api/builds-provider";

/**
 * Progressive mock log lines for a selected build.
 * Unsubscribes on close / build change (no full page reload).
 */
export function useBuildLogStream(
    projectId: string,
    buildId: null | string
): { isStreaming: boolean; lines: BuildLogLine[] } {
    const [lines, setLines] = useState<BuildLogLine[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);

    useEffect(() => {
        if (!buildId) {
            setLines([]);
            setIsStreaming(false);
            return;
        }

        setLines([]);
        setIsStreaming(true);

        const stop = buildsProvider.streamBuildLogs(
            projectId,
            buildId,
            (line) => {
                if (line.text.length > 0) {
                    setLines((previous) => [...previous, line]);
                }
                if (line.done) {
                    setIsStreaming(false);
                }
            }
        );

        return () => {
            stop();
            setIsStreaming(false);
        };
    }, [buildId, projectId]);

    return { isStreaming, lines };
}
