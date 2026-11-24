import { useQueryClient } from "@tanstack/react-query";
import {
    useLocation,
    useNavigate,
    useParams,
    useSearch,
} from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import {
    resolveTaskIdFromUrlReference,
    resolveTaskKeyForUrl,
} from "@/features/tasks/lib/task-url-reference";
import { resolveTaskUrlSyncAction } from "@/features/tasks/model/resolve-task-url-sync-action";
import { parseTaskBoardSearch } from "@/features/tasks/model/task-board-search";
import { useTasksUiStore } from "@/features/tasks/model/use-tasks-ui-store";

/**
 * Keeps `?task=<key|id>` in sync with the Task drawer on Board routes
 * (Kanban, Backlog, Sprints, Sprint report). The param is written on the
 * current route, keeping its other search params, so opening a Task from a
 * report does not jump to the Kanban.
 * Opening a shared link selects the Task; closing the drawer clears the param.
 */
export function useSyncTaskUrl() {
    const queryClient = useQueryClient();
    const location = useLocation();
    const navigate = useNavigate();
    const { boardId, projectId } = useParams({ strict: false });
    const search = parseTaskBoardSearch(
        useSearch({ strict: false }) as Record<string, unknown>
    );
    const selectedTaskId = useTasksUiStore((state) => state.selectedTaskId);
    const selectTask = useTasksUiStore((state) => state.selectTask);
    const clearSelectedTask = useTasksUiStore(
        (state) => state.clearSelectedTask
    );

    const onBoardRoute =
        Boolean(boardId && projectId) && location.pathname.includes("/boards/");

    const urlTaskReference = search.task;
    const urlTaskId =
        onBoardRoute && projectId && urlTaskReference
            ? resolveTaskIdFromUrlReference(
                  queryClient,
                  projectId,
                  urlTaskReference
              )
            : undefined;
    const selectedTaskKey =
        onBoardRoute && projectId && selectedTaskId
            ? resolveTaskKeyForUrl(queryClient, projectId, selectedTaskId)
            : undefined;

    const previousUrlTaskReference = useRef(urlTaskReference);
    const wasSelectedReference = useRef(false);

    useEffect(() => {
        if (!onBoardRoute || !boardId || !projectId) return;

        const hadUrlTask = previousUrlTaskReference.current;
        previousUrlTaskReference.current = urlTaskReference;

        if (selectedTaskId) {
            wasSelectedReference.current = true;
        }

        const action = resolveTaskUrlSyncAction({
            hadUrlTask,
            selectedTaskId,
            selectedTaskKey,
            urlTaskId,
            urlTaskRef: urlTaskReference,
            wasSelected: wasSelectedReference.current,
        });

        switch (action.type) {
            case "clear-selection": {
                clearSelectedTask();
                break;
            }
            case "noop": {
                break;
            }
            case "push-url": {
                const taskReference = action.taskRef;
                void navigate({
                    replace: true,
                    resetScroll: false,
                    search: (previous) => ({
                        ...previous,
                        task: taskReference,
                    }),
                    to: ".",
                    viewTransition: false,
                });
                break;
            }
            case "select-from-url": {
                selectTask(action.taskId);
                break;
            }
            case "strip-url": {
                wasSelectedReference.current = false;
                void navigate({
                    replace: true,
                    resetScroll: false,
                    search: (previous) => withoutTaskParameter(previous),
                    to: ".",
                    viewTransition: false,
                });
                break;
            }
        }
    }, [
        boardId,
        clearSelectedTask,
        navigate,
        onBoardRoute,
        projectId,
        queryClient,
        selectTask,
        selectedTaskId,
        selectedTaskKey,
        urlTaskId,
        urlTaskReference,
    ]);
}

function withoutTaskParameter<T extends object>(search: T): Omit<T, "task"> {
    const rest = { ...search } as Record<string, unknown>;
    delete rest.task;
    return rest as Omit<T, "task">;
}
