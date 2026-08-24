import {
    closestCenter,
    closestCorners,
    type CollisionDetection,
    pointerWithin,
} from "@dnd-kit/core";

import { columnTaskDropId } from "@/features/tasks/lib/board-drop-target-id";

/**
 * Column drags must never fall through to task droppables. An unscoped
 * `closestCorners` fallback (gaps between wide columns) makes `over` thrash
 * between cards and columns — the drop-gap preview flickers.
 */
export const boardCollisionDetection: CollisionDetection = (arguments_) => {
    if (arguments_.active.data.current?.type === "column") {
        const columnContainers = arguments_.droppableContainers.filter(
            (container) => container.data.current?.type === "column"
        );
        const scoped = {
            ...arguments_,
            droppableContainers: columnContainers,
        };
        const pointerCollisions = pointerWithin(scoped);
        if (pointerCollisions.length > 0) return pointerCollisions;
        return closestCenter(scoped);
    }

    if (arguments_.active.data.current?.type === "task") {
        const filterByType = (type: string) =>
            arguments_.droppableContainers.filter(
                (container) => container.data.current?.type === type
            );

        const taskPointerHits = pointerWithin({
            ...arguments_,
            droppableContainers: filterByType("task"),
        });
        if (taskPointerHits.length > 0) return taskPointerHits;

        const columnTaskZoneHits = pointerWithin({
            ...arguments_,
            droppableContainers: filterByType("column-tasks"),
        });
        if (columnTaskZoneHits.length > 0) return columnTaskZoneHits;

        const columnPointerHits = pointerWithin({
            ...arguments_,
            droppableContainers: filterByType("column"),
        });
        if (columnPointerHits.length > 0) {
            const columnId = String(columnPointerHits[0]!.id);
            const taskZoneId = columnTaskDropId(columnId);
            const taskZone = arguments_.droppableContainers.find(
                (container) => container.id === taskZoneId
            );
            if (taskZone) {
                return [{ data: taskZone.data, id: taskZoneId }];
            }
            return columnPointerHits;
        }

        const columnDropTargets = [
            ...filterByType("column-tasks"),
            ...filterByType("column"),
        ];
        const closestColumnTarget = closestCenter({
            ...arguments_,
            droppableContainers: columnDropTargets,
        });
        if (closestColumnTarget.length > 0) {
            const hitId = String(closestColumnTarget[0]!.id);
            const hitContainer = arguments_.droppableContainers.find(
                (container) => container.id === hitId
            );
            if (hitContainer?.data.current?.type === "column") {
                const taskZoneId = columnTaskDropId(hitId);
                const taskZone = arguments_.droppableContainers.find(
                    (container) => container.id === taskZoneId
                );
                if (taskZone) {
                    return [{ data: taskZone.data, id: taskZoneId }];
                }
            }
            return closestColumnTarget;
        }
    }

    return closestCorners(arguments_);
};
