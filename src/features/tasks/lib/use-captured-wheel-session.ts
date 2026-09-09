import { useLayoutEffect, useRef } from "react";

/** Keep capturing wheel after the handle moves out from under the cursor. */
export const WHEEL_GESTURE_IDLE_MS = 320;

type UseCapturedWheelSessionOptions = {
    /** Extra hover targets (e.g. drawer header) that also start the gesture. */
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
 * Wheel over `rootRef` (or `additionalTargets`) starts a short-lived session
 * that continues on `window` so the control still receives deltas when layout
 * moves the hit target.
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

    // Layout: bind after sibling header refs are committed in the same paint.
    useLayoutEffect(() => {
        if (!enabled) return;

        const targets: HTMLElement[] = [];
        if (rootReference.current) targets.push(rootReference.current);
        for (const target of additionalTargetsReference.current ?? []) {
            if (target.current) targets.push(target.current);
        }
        if (targets.length === 0) return;

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

        const apply = (event: WheelEvent) => {
            if (shouldIgnoreReference.current?.()) return;
            event.preventDefault();
            event.stopPropagation();
            bumpSession();
            onWheelReference.current({
                deltaX: event.deltaX,
                deltaY: event.deltaY,
            });
        };

        const onTargetWheel = (event: WheelEvent) => {
            apply(event);
        };

        const onWindowWheel = (event: WheelEvent) => {
            if (!sessionActiveReference.current) return;
            apply(event);
        };

        for (const target of targets) {
            target.addEventListener("wheel", onTargetWheel, { passive: false });
        }
        window.addEventListener("wheel", onWindowWheel, {
            capture: true,
            passive: false,
        });

        return () => {
            endSession();
            for (const target of targets) {
                target.removeEventListener("wheel", onTargetWheel);
            }
            window.removeEventListener("wheel", onWindowWheel, {
                capture: true,
            });
        };
        // additionalTargets are read via ref so inline arrays do not rebind every render.
    }, [enabled]);

    return rootReference;
}
