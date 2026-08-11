import { useCallback, useRef } from "react";

/**
 * Close a controlled Drawer and resolve after `onOpenChangeComplete(false)`.
 * Wire `onOpenChangeComplete` onto the Drawer root.
 */
export function useAwaitableDrawerClose(
    open: boolean,
    setOpen: (open: boolean) => void
) {
    const resolveCloseReference = useRef<(() => void) | null>(null);

    const closeAndWait = useCallback(() => {
        return new Promise<void>((resolve) => {
            if (!open) {
                resolve();
                return;
            }
            resolveCloseReference.current = resolve;
            setOpen(false);
        });
    }, [open, setOpen]);

    const onOpenChangeComplete = useCallback((nextOpen: boolean) => {
        if (nextOpen) return;
        resolveCloseReference.current?.();
        resolveCloseReference.current = null;
    }, []);

    return { closeAndWait, onOpenChangeComplete };
}
