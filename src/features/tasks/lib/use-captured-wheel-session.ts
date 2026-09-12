import { useEffect, useRef } from "react";

import { hasDrawerWheelModifier } from "@/features/tasks/lib/resolve-task-drawer-placement";

/** Keep capturing wheel after the handle moves out from under the cursor. */
export const WHEEL_GESTURE_IDLE_MS = 320;

type UseCapturedWheelSessionOptions = {
    /** Extra hit areas (e.g. the whole drawer surface) that own the gesture. */
    additionalTargets?: ReadonlyArray<{ current: HTMLElement | null }>;
    enabled?: boolean;
    /** Skip handling (e.g. while a pointer drag is active). */
    shouldIgnore?: () => boolean;
};

type WheelDelta = {
    deltaX: number;
    deltaY: number;
};

/**
 * Alt + wheel anywhere inside `rootRef` or `additionalTargets` starts a
 * short-lived session that keeps receiving deltas even once the cursor leaves
 * those elements, so resizing survives the layout moving under the pointer.
 * Unmodified wheel is left to the page so normal scrolling keeps working.
 */
export function useCapturedWheelSession(
    onWheel: (delta: WheelDelta) => void,
    options: UseCapturedWheelSessionOptions = {}
) {
    const { additionalTargets, enabled = true, shouldIgnore } = options;
    const rootReference = useRef<HTMLDivElement>(null);
    const onWheelReference = useRef(onWheel);
    const shouldIgnoreReference = useRef(shouldIgnore);
    const additionalTargetsReference = useRef(additionalTargets);
    const sessionActiveReference = useRef(false);
    const idleTimerReference = useRef<null | ReturnType<typeof setTimeout>>(
        null
    );

    onWheelReference.current = onWheel;
    shouldIgnoreReference.current = shouldIgnore;
    additionalTargetsReference.current = additionalTargets;

    useEffect(() => {
        if (!enabled) return;

        const endSession = () => {
            sessionActiveReference.current = false;
            if (idleTimerReference.current != undefined) {
                globalThis.clearTimeout(idleTimerReference.current);
                idleTimerReference.current = null;
            }
        };

        const bumpSession = () => {
            sessionActiveReference.current = true;
            if (idleTimerReference.current != undefined) {
                globalThis.clearTimeout(idleTimerReference.current);
            }
            idleTimerReference.current = globalThis.setTimeout(
                endSession,
                WHEEL_GESTURE_IDLE_MS
            );
        };

        // Refs are read per event so remounted / late-committed nodes still count.
        const isInsideTargets = (node: EventTarget | null) => {
            if (!(node instanceof Node)) return false;
            if (rootReference.current?.contains(node)) return true;
            for (const target of additionalTargetsReference.current ?? []) {
                if (target.current?.contains(node)) return true;
            }
            return false;
        };

        const onWindowWheel = (event: WheelEvent) => {
            if (!hasDrawerWheelModifier(event)) {
                // Releasing the modifier hands scrolling back to the page.
                endSession();
                return;
            }
            if (shouldIgnoreReference.current?.()) return;
            if (
                !sessionActiveReference.current &&
                !isInsideTargets(event.target)
            ) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            bumpSession();
            onWheelReference.current({
                deltaX: event.deltaX,
                deltaY: event.deltaY,
            });
        };

        window.addEventListener("wheel", onWindowWheel, {
            capture: true,
            passive: false,
        });

        return () => {
            endSession();
            window.removeEventListener("wheel", onWindowWheel, {
                capture: true,
            });
        };
        // additionalTargets are read via ref so inline arrays do not rebind every render.
    }, [enabled]);

    return rootReference;
}
