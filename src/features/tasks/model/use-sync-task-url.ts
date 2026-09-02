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
 * Keeps `?task=<key|id>` in sync with the Task drawer on Board routes.
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

    const boardRoute = location.pathname.endsWith("/backlog")
        ? "/projects/$projectId/boards/$boardId/backlog"
        : "/projects/$projectId/boards/$boardId";

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
                void navigate({
                    params: { boardId, projectId },
                    replace: true,
                    search: { task: action.taskRef },
                    to: boardRoute,
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
                    params: { boardId, projectId },
                    replace: true,
                    search: {},
                    to: boardRoute,
                    viewTransition: false,
                });
                break;
            }
        }
    }, [
        boardId,
        boardRoute,
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
