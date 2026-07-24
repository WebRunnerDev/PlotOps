import { useEffect, useState } from "react";

import type {
    BuildLogLine,
    BuildsForProject,
} from "@/features/ci-cd/model/types";

import { mockBuildsForProject } from "@/features/ci-cd/api/mock-builds";

/** Same provider as listBuilds — swap for GitHub Actions later at this seam. */
const buildsProvider: BuildsForProject = mockBuildsForProject;

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
                setLines((previous) => [...previous, line]);
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
