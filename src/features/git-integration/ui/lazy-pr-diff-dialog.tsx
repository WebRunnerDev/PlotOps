import { type ComponentProps, lazy, type ReactNode, Suspense } from "react";

import type { PrDiffDialog as PrDiffDialogImpl } from "@/features/git-integration/ui/pr-diff-dialog";

import { cn } from "@/shared/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/shared/shadcn/ui/dialog";
import { Spinner } from "@/shared/shadcn/ui/spinner";
import { ChunkErrorBoundary, ChunkLoadFailed } from "@/shared/ui/chunk-load";

type PrDiffDialogProperties = ComponentProps<typeof PrDiffDialogImpl>;

// @git-diff-view and its highlighter load only when a diff is opened.
const importPrDiffDialog = () =>
    import("@/features/git-integration/ui/pr-diff-dialog").then((module) => ({
        default: module.PrDiffDialog,
    }));

let dialogModule: ReturnType<typeof importPrDiffDialog> | undefined;

const loadPrDiffDialog = () => {
    dialogModule ??= importPrDiffDialog().catch((error: unknown) => {
        dialogModule = undefined;
        throw error;
    });
    return dialogModule;
};

const LazyPrDiffDialogImpl = lazy(loadPrDiffDialog);

export function PrDiffDialog(properties: PrDiffDialogProperties) {
    return (
        <ChunkErrorBoundary
            fallback={
                <PrDiffDialogShell {...properties}>
                    <ChunkLoadFailed className="m-4" />
                </PrDiffDialogShell>
            }
        >
            <Suspense
                fallback={
                    <PrDiffDialogShell {...properties}>
                        <div className="flex flex-1 items-center justify-center">
                            <Spinner />
                        </div>
                    </PrDiffDialogShell>
                }
            >
                <LazyPrDiffDialogImpl {...properties} />
            </Suspense>
        </ChunkErrorBoundary>
    );
}

/** Start fetching the diff viewer — wire to hover/focus on "View diff". */
export function preloadPrDiffDialog(): void {
    loadPrDiffDialog().catch(() => {
        // Prefetch only — the render path shows ChunkLoadFailed.
    });
}

/** Same frame as the real dialog, so opening it does not jump in size. */
function PrDiffDialogShell({
    children,
    onClose,
    open,
    prNumber,
    prTitle,
}: PrDiffDialogProperties & { children: ReactNode }) {
    return (
        <Dialog
            onOpenChange={(next) => {
                if (!next) onClose();
            }}
            open={open}
        >
            <DialogContent
                className={cn(
                    "flex max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none",
                    "max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none",
                    "h-[85vh] w-[min(96vw,72rem)]"
                )}
            >
                <DialogHeader className="border-b border-border px-4 py-3 text-left">
                    <DialogTitle className="flex min-w-0 items-center gap-2 text-sm">
                        <span className="shrink-0 font-mono text-muted-foreground">
                            #{prNumber}
                        </span>
                        <span className="truncate">{prTitle}</span>
                    </DialogTitle>
                </DialogHeader>
                {children}
            </DialogContent>
        </Dialog>
    );
}
