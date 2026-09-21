import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import type { ProjectEpic } from "@/features/tasks/model/types";

import { isGuest } from "@/features/guest-mode";
import { resolveTasksProvider } from "@/features/tasks/api/resolve-tasks-provider";
import { taskKeys } from "@/features/tasks/model/query-keys";

const EMPTY_EPICS: ProjectEpic[] = [];

/** Every Epic in a Project (all Boards, archived included) with progress. */
export function useProjectEpics(projectId: string, enabled = true) {
    const provider = resolveTasksProvider(isGuest());
    const query = useQuery({
        enabled: Boolean(projectId) && enabled,
        queryFn: () => provider.fetchProjectEpics(projectId),
        queryKey: taskKeys.epics(projectId),
    });
    const epics = query.data ?? EMPTY_EPICS;
    const epicsById = useMemo(
        () => new Map(epics.map((epic) => [epic.id, epic] as const)),
        [epics]
    );
    return { ...query, epics, epicsById };
}
