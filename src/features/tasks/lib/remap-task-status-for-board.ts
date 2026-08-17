import type { BoardColumn } from "@/features/boards";
import type { TaskStatus } from "@/features/tasks/model/types";

/** Pick a target-board column for a task status (name match, else first column). */
export function remapTaskStatusForBoard(
    sourceStatus: TaskStatus,
    sourceColumns: readonly BoardColumn[],
    targetColumns: readonly BoardColumn[]
): TaskStatus {
    if (targetColumns.length === 0) {
        return sourceStatus;
    }

    const sourceColumn = sourceColumns.find(
        (column) => column.id === sourceStatus
    );
    const sameName = sourceColumn
        ? targetColumns.find(
              (column) =>
                  column.name.trim().toLowerCase() ===
                  sourceColumn.name.trim().toLowerCase()
          )
        : undefined;

    return (sameName?.id ?? targetColumns[0]!.id) as TaskStatus;
}
