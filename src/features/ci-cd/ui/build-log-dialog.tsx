import { useTranslation } from "react-i18next";

import type { ProjectBuild } from "@/features/ci-cd/model/types";

import { useBuildLogStream } from "@/features/ci-cd/model/use-build-log-stream";
import { cn } from "@/shared/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/shared/shadcn/ui/dialog";
import { ScrollArea } from "@/shared/shadcn/ui/scroll-area";

type BuildLogDialogProperties = {
    build: null | ProjectBuild;
    onClose: () => void;
    open: boolean;
    projectId: string;
};

export function BuildLogDialog({
    build,
    onClose,
    open,
    projectId,
}: BuildLogDialogProperties) {
    const { t } = useTranslation("board");
    const { isStreaming, lines } = useBuildLogStream(
        projectId,
        open && build ? build.id : null
    );

    return (
        <Dialog
            onOpenChange={(nextOpen) => {
                if (!nextOpen) onClose();
            }}
            open={open}
        >
            <DialogContent className="flex max-h-[min(90vh,40rem)] w-full max-w-3xl flex-col gap-3 overflow-hidden rounded-none sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle className="font-mono text-h3">
                        {build
                            ? t("cicd.logs.title", { branch: build.branch })
                            : t("cicd.logs.titleFallback")}
                    </DialogTitle>
                    <DialogDescription className="font-mono text-meta text-muted-foreground">
                        {build
                            ? `${build.commitSha} · ${build.commitMessage}`
                            : t("cicd.logs.mockHint")}
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="min-h-0 flex-1 rounded-none border border-border bg-background">
                    <pre
                        aria-live="polite"
                        className={cn(
                            "m-0 min-h-48 whitespace-pre-wrap p-3 font-mono text-code text-foreground",
                            "selection:bg-primary/30"
                        )}
                    >
                        {lines.map((line) => (
                            <span className="block" key={line.index}>
                                {line.text}
                            </span>
                        ))}
                        {isStreaming ? (
                            <span
                                aria-hidden
                                className="inline-block animate-pulse text-emerald-400"
                            >
                                ▌
                            </span>
                        ) : null}
                        {!isStreaming && lines.length === 0 ? (
                            <span className="text-muted-foreground">
                                {t("cicd.logs.empty")}
                            </span>
                        ) : null}
                    </pre>
                </ScrollArea>

                <p className="text-meta uppercase tracking-wide text-muted-foreground">
                    {isStreaming
                        ? t("cicd.logs.streaming")
                        : t("cicd.logs.mockHint")}
                </p>
            </DialogContent>
        </Dialog>
    );
}
