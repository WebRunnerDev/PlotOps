import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import {
    MAX_SIDE_DRAWER_WIDTH_PX,
    MIN_SIDE_DRAWER_WIDTH_PX,
    resolveSideDrawerPointerDrag,
} from "@/features/tasks/lib/resolve-task-drawer-placement";

type TaskDrawerSideEdgeHandleProperties = {
    onClose: () => void;
    onWidthChange: (widthPx: number) => void;
    side: "left" | "right";
    widthPx: number;
};

/**
 * Free-edge drag control for side Task drawers (same grab affordance as the
 * bottom swipe handle): drag to change width, pull past compact min to dismiss.
 */
export function TaskDrawerSideEdgeHandle({
    onClose,
    onWidthChange,
    side,
    widthPx,
}: TaskDrawerSideEdgeHandleProperties) {
    const { t } = useTranslation("common");
    const dragReference = useRef<null | {
        pointerId: number;
        startClientX: number;
        startWidthPx: number;
    }>(null);
    const closedReference = useRef(false);

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
            onWidthChange(result.widthPx);
            if (result.shouldClose && !closedReference.current) {
                closedReference.current = true;
                dragReference.current = null;
                document.body.style.removeProperty("cursor");
                document.body.style.removeProperty("user-select");
                onClose();
            }
        };

        const endDrag = (event: PointerEvent) => {
            const drag = dragReference.current;
            if (!drag || event.pointerId !== drag.pointerId) return;
            dragReference.current = null;
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
    }, [onClose, onWidthChange, side]);

    return (
        <div
            aria-label={t("uiSettings.dragDrawer")}
            aria-orientation="horizontal"
            aria-valuemax={MAX_SIDE_DRAWER_WIDTH_PX}
            aria-valuemin={MIN_SIDE_DRAWER_WIDTH_PX}
            aria-valuenow={widthPx}
            className="relative z-30 flex h-full w-3 shrink-0 touch-none cursor-grab items-center justify-center active:cursor-grabbing"
            onPointerDown={(event) => {
                if (event.button !== 0) return;
                event.preventDefault();
                event.stopPropagation();
                closedReference.current = false;
                dragReference.current = {
                    pointerId: event.pointerId,
                    startClientX: event.clientX,
                    startWidthPx: widthPx,
                };
                document.body.style.cursor = "grabbing";
                document.body.style.userSelect = "none";
            }}
            role="slider"
        >
            <span
                aria-hidden="true"
                className="h-24 w-1 rounded-none bg-muted-foreground/55 transition-colors duration-150 hover:bg-primary/70"
            />
        </div>
    );
}
