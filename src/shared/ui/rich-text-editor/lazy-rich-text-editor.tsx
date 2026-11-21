import { forwardRef, lazy, Suspense } from "react";

import type {
    RichTextEditorHandle,
    RichTextEditorProperties,
} from "@/shared/ui/rich-text-editor/rich-text-editor";

import { cn } from "@/shared/lib/utils";
import { Skeleton } from "@/shared/shadcn/ui/skeleton";
import { ChunkErrorBoundary, ChunkLoadFailed } from "@/shared/ui/chunk-load";

// TipTap, ProseMirror and lowlight are ~2 MB of JS. Loading them on demand
// keeps them out of the chunks every route preloads.
const importRichTextEditor = () =>
    import("@/shared/ui/rich-text-editor/rich-text-editor").then((module) => ({
        default: module.RichTextEditor,
    }));

let editorModule: ReturnType<typeof importRichTextEditor> | undefined;

const loadRichTextEditor = () => {
    editorModule ??= importRichTextEditor().catch((error: unknown) => {
        // Drop a failed fetch so the next caller asks the network again.
        editorModule = undefined;
        throw error;
    });
    return editorModule;
};

const RichTextEditorImpl = lazy(loadRichTextEditor);

/**
 * Start fetching the editor chunk ahead of first render — wire to hover/focus
 * on anything that opens a Task, or to idle time on pages that list Tasks.
 * Idempotent; failures are silent here and surface on the real render.
 */
export function preloadRichTextEditor(): void {
    loadRichTextEditor().catch(() => {
        // Prefetch only — the render path shows ChunkLoadFailed.
    });
}

export const RichTextEditor = forwardRef<
    RichTextEditorHandle,
    RichTextEditorProperties
>(function LazyRichTextEditor(properties, reference) {
    return (
        <ChunkErrorBoundary
            fallback={<ChunkLoadFailed className={properties.className} />}
        >
            <Suspense
                fallback={
                    <RichTextEditorSkeleton
                        className={properties.className}
                        compact={properties.compact}
                        readOnly={properties.readOnly}
                    />
                }
            >
                <RichTextEditorImpl {...properties} ref={reference} />
            </Suspense>
        </ChunkErrorBoundary>
    );
});

function RichTextEditorSkeleton({
    className,
    compact,
    readOnly,
}: Pick<RichTextEditorProperties, "className" | "compact" | "readOnly">) {
    return (
        <Skeleton
            aria-hidden
            className={cn(
                "w-full",
                readOnly ? "h-6" : compact ? "h-24" : "h-40",
                className
            )}
        />
    );
}
