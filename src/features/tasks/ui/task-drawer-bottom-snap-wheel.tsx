import { type ReactNode, useRef } from "react";

import {
    bottomDrawerWheelIntent,
    resolveBottomDrawerWheelStep,
} from "@/features/tasks/lib/resolve-task-drawer-placement";
import { useCapturedWheelSession } from "@/features/tasks/lib/use-captured-wheel-session";

type TaskDrawerBottomSnapWheelProperties = {
    activeSnapPoint: number | string;
    children: ReactNode;
    className?: string;
    onClose: () => void;
    onSnapPointChange: (snapPoint: number | string) => void;
    snapPoints: readonly (number | string)[];
};

/**
 * Wraps the bottom-sheet chrome (header) so wheel expands/collapses snap
 * points. Drag-to-resize stays on the native Drawer swipe handle.
 */
export function TaskDrawerBottomSnapWheel({
    activeSnapPoint,
    children,
    className,
    onClose,
    onSnapPointChange,
    snapPoints,
}: TaskDrawerBottomSnapWheelProperties) {
    const accumulatedReference = useRef(0);
    const closedReference = useRef(false);
    const activeSnapReference = useRef(activeSnapPoint);
    const onCloseReference = useRef(onClose);
    const onSnapPointChangeReference = useRef(onSnapPointChange);
    const snapPointsReference = useRef(snapPoints);

    activeSnapReference.current = activeSnapPoint;
    onCloseReference.current = onClose;
    onSnapPointChangeReference.current = onSnapPointChange;
    snapPointsReference.current = snapPoints;

    const rootReference = useCapturedWheelSession(({ deltaX, deltaY }) => {
        const points = snapPointsReference.current;
        const activeIndex = Math.max(
            0,
            points.indexOf(activeSnapReference.current)
        );
        accumulatedReference.current += bottomDrawerWheelIntent(deltaX, deltaY);
        const step = resolveBottomDrawerWheelStep({
            accumulatedDelta: accumulatedReference.current,
            activeIndex,
            snapPointCount: points.length,
        });
        accumulatedReference.current = step.nextAccumulatedDelta;
        if (!step.didStep) return;
        if (step.nextIndex === null) {
            if (!closedReference.current) {
                closedReference.current = true;
                onCloseReference.current();
            }
            return;
        }
        closedReference.current = false;
        const next = points[step.nextIndex];
        if (next !== undefined) {
            onSnapPointChangeReference.current(next);
        }
    });

    return (
        <div className={className} ref={rootReference}>
            {children}
        </div>
    );
}
