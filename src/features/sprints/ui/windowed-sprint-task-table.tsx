import type { OnChangeFn, RowSelectionState } from "@tanstack/react-table";

import type { ProjectLabel } from "@/features/labels";
import type { Task } from "@/features/tasks";

import {
    BACKLOG_LIST_PAGE_SIZE,
    shouldOfferSelectAllMatching,
    windowListItems,
} from "@/features/sprints/model/list-window";
import { useListWindow } from "@/features/sprints/model/use-list-window";
import {
    ListWindowControls,
    SelectAllMatchingBanner,
} from "@/features/sprints/ui/list-window-controls";
import { SprintTaskTable } from "@/features/sprints/ui/sprint-task-table";

type WindowedSprintTaskTableProperties = {
    canManage: boolean;
    containerId: string;
    draggingTaskIds: string[];
    labels: ProjectLabel[];
    onOpenTask?: (taskId: string) => void;
    onRowSelectionChange: OnChangeFn<RowSelectionState>;
    resetKey: string;
    rowSelection: RowSelectionState;
    tasks: Task[];
};

export function WindowedSprintTaskTable({
    canManage,
    containerId,
    draggingTaskIds,
    labels,
    onOpenTask,
    onRowSelectionChange,
    resetKey,
    rowSelection,
    tasks,
}: WindowedSprintTaskTableProperties) {
    const { loadMore, showAll, visibleCount } = useListWindow(resetKey);
    const listWindow = windowListItems(tasks, visibleCount);
    const selectedVisibleCount = listWindow.visible.reduce(
        (count, task) => count + (rowSelection[task.id] ? 1 : 0),
        0
    );
    const offerSelectAllMatching = shouldOfferSelectAllMatching({
        selectedVisibleCount,
        totalCount: tasks.length,
        visibleCount: listWindow.visible.length,
    });

    return (
        <>
            <SelectAllMatchingBanner
                onSelectAll={() => {
                    onRowSelectionChange((previous) => {
                        const next = { ...previous };
                        for (const task of tasks) {
                            next[task.id] = true;
                        }
                        return next;
                    });
                    showAll(tasks.length);
                }}
                totalCount={tasks.length}
                visible={offerSelectAllMatching}
            />
            <SprintTaskTable
                canManage={canManage}
                containerId={containerId}
                draggingTaskIds={draggingTaskIds}
                labels={labels}
                onOpenTask={onOpenTask}
                onRowSelectionChange={onRowSelectionChange}
                rowSelection={rowSelection}
                tasks={listWindow.visible}
            />
            <ListWindowControls
                hasMore={listWindow.hasMore}
                nextCount={Math.min(
                    BACKLOG_LIST_PAGE_SIZE,
                    listWindow.remaining
                )}
                onLoadMore={() => {
                    loadMore(tasks.length);
                }}
                onShowAll={() => {
                    showAll(tasks.length);
                }}
            />
        </>
    );
}
