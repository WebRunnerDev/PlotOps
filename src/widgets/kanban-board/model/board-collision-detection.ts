import {
    closestCenter,
    closestCorners,
    type CollisionDetection,
    pointerWithin,
} from "@dnd-kit/core";

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
        if (columnPointerHits.length > 0) return columnPointerHits;
    }

    return closestCorners(arguments_);
};
