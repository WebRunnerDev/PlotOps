import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import {
    MAX_SIDE_DRAWER_WIDTH_PX,
    MIN_SIDE_DRAWER_WIDTH_PX,
    resolveSideDrawerPointerDrag,
    resolveSideDrawerWheelDelta,
} from "@/features/tasks/lib/resolve-task-drawer-placement";
import { useCapturedWheelSession } from "@/features/tasks/lib/use-captured-wheel-session";

type TaskDrawerSideEdgeHandleProperties = {
    /** Also wheel-resize from inside these (the whole drawer surface). */
    additionalWheelTargets?: ReadonlyArray<{ current: HTMLElement | null }>;
    onClose: () => void;
    onWidthChange: (widthPx: number) => void;
    side: "left" | "right";
    widthPx: number;
};

/**
 * Free-edge drag control for side Task drawers (same grab affordance as the
 * bottom swipe handle): drag or Alt+wheel to change width, pull past compact
 * min to dismiss. Alt+wheel works anywhere inside the drawer and uses a
 * captured session so resizing continues when the cursor falls outside.
 */
export function TaskDrawerSideEdgeHandle({
    additionalWheelTargets,
    onClose,
    onWidthChange,
    side,
    widthPx,
}: TaskDrawerSideEdgeHandleProperties) {
    const { t } = useTranslation("common");
    const rootReference = useRef<HTMLDivElement>(null);
    const dragReference = useRef<null | {
        pointerId: number;
        startClientX: number;
        startWidthPx: number;
    }>(null);
    const closedReference = useRef(false);
    const widthReference = useRef(widthPx);
    const onCloseReference = useRef(onClose);
    const onWidthChangeReference = useRef(onWidthChange);

    widthReference.current = widthPx;
    onCloseReference.current = onClose;
    onWidthChangeReference.current = onWidthChange;

    useEffect(() => {
        const onPointerMove = (event: PointerEvent) => {
            const drag = dragReference.current;
            if (!drag || event.pointerId !== drag.pointerId) return;
            const result = resolveSideDrawerPointerDrag({
                clientX: event.clientX,
                side,
                startClientX: drag.startClientX,
                startWidthPx: drag.startWidthPx,
                viewportWidthPx: window.innerWidth,
            });
            onWidthChangeReference.current(result.widthPx);
            if (result.shouldClose && !closedReference.current) {
                closedReference.current = true;
                dragReference.current = null;
                document.body.style.removeProperty("cursor");
                document.body.style.removeProperty("user-select");
                onCloseReference.current();
            }
        };

        const endDrag = (event: PointerEvent) => {
            const drag = dragReference.current;
            if (!drag || event.pointerId !== drag.pointerId) return;
            dragReference.current = null;
            const node = rootReference.current;
            if (node?.hasPointerCapture(event.pointerId)) {
                node.releasePointerCapture(event.pointerId);
            }
            document.body.style.removeProperty("cursor");
            document.body.style.removeProperty("user-select");
        };

        globalThis.addEventListener("pointermove", onPointerMove);
        globalThis.addEventListener("pointerup", endDrag);
        globalThis.addEventListener("pointercancel", endDrag);
        return () => {
            globalThis.removeEventListener("pointermove", onPointerMove);
            globalThis.removeEventListener("pointerup", endDrag);
            globalThis.removeEventListener("pointercancel", endDrag);
        };
    }, [side]);

    const wheelTargetReference = useCapturedWheelSession(
        ({ deltaX, deltaY }) => {
            const result = resolveSideDrawerWheelDelta({
                deltaX,
                deltaY,
                side,
                viewportWidthPx: window.innerWidth,
                widthPx: widthReference.current,
            });
            onWidthChangeReference.current(result.widthPx);
            if (result.shouldClose && !closedReference.current) {
                closedReference.current = true;
                onCloseReference.current();
            }
        },
        {
            additionalTargets: additionalWheelTargets,
            shouldIgnore: () => dragReference.current != undefined,
        }
    );

    return (
        <div
            aria-label={t("uiSettings.dragDrawer")}
            aria-orientation="horizontal"
            aria-valuemax={MAX_SIDE_DRAWER_WIDTH_PX}
            aria-valuemin={MIN_SIDE_DRAWER_WIDTH_PX}
            aria-valuenow={widthPx}
            className="relative z-30 flex h-full w-5 shrink-0 touch-none cursor-grab items-center justify-center active:cursor-grabbing"
            onPointerDown={(event) => {
                if (event.button !== 0) return;
                event.preventDefault();
                event.stopPropagation();
                closedReference.current = false;
                dragReference.current = {
                    pointerId: event.pointerId,
                    startClientX: event.clientX,
                    startWidthPx: widthReference.current,
                };
                event.currentTarget.setPointerCapture(event.pointerId);
                document.body.style.cursor = "grabbing";
                document.body.style.userSelect = "none";
            }}
            ref={(node) => {
                rootReference.current = node;
                wheelTargetReference.current = node;
            }}
            role="slider"
        >
            <span
                aria-hidden="true"
                className="h-64 w-1 rounded-none bg-muted-foreground/55 transition-colors duration-150 hover:bg-primary/70"
            />
        </div>
    );
}
