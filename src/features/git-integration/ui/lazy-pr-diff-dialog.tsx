import { type ComponentProps, lazy, Suspense } from "react";

import type { PrDiffDialog as PrDiffDialogImpl } from "@/features/git-integration/ui/pr-diff-dialog";

// @git-diff-view and its highlighter load only when a diff is opened.
const LazyPrDiffDialogImpl = lazy(() =>
    import("@/features/git-integration/ui/pr-diff-dialog").then((module) => ({
        default: module.PrDiffDialog,
    }))
);

export function PrDiffDialog(
    properties: ComponentProps<typeof PrDiffDialogImpl>
) {
    return (
        <Suspense fallback={null}>
            <LazyPrDiffDialogImpl {...properties} />
        </Suspense>
    );
}
