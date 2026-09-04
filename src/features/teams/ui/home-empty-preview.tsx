import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";

const COLUMNS = [
    { key: "backlog", tasks: [0.92, 0.7] },
    { key: "progress", tasks: [0.85, 0.58, 0.72] },
    { key: "done", tasks: [0.64, 0.8] },
] as const;

type HomeEmptyPreviewProperties = {
    className?: string;
};

/** Decorative mini board + branch strip — the home empty screenshot moment. */
export function HomeEmptyPreview({ className }: HomeEmptyPreviewProperties) {
    const { t } = useTranslation("home");

    return (
        <div
            aria-hidden
            className={cn(
                "relative w-full max-w-lg overflow-hidden border border-border bg-background/80",
                className
            )}
        >
            <div className="pointer-events-none absolute inset-0 bg-auth-atmosphere opacity-70" />

            <div className="relative flex items-center justify-between gap-3 border-b border-border px-3 py-2 sm:px-4">
                <span className="min-w-0 truncate font-mono text-code text-primary">
                    {t("emptyPreview.branch")}
                </span>
                <span className="inline-flex shrink-0 items-center gap-1.5 font-mono text-meta text-success">
                    <span className="size-1.5 bg-success motion-safe:animate-pulse" />
                    {t("emptyPreview.ci")}
                </span>
            </div>

            <div className="relative grid grid-cols-3 gap-2 p-3 sm:gap-3 sm:p-4">
                {COLUMNS.map((column, columnIndex) => (
                    <div
                        className="flex min-w-0 flex-col gap-2"
                        key={column.key}
                    >
                        <span className="truncate font-mono text-meta text-muted-foreground">
                            {t(`emptyPreview.columns.${column.key}`)}
                        </span>
                        <div className="flex flex-col gap-1.5">
                            {column.tasks.map((width, taskIndex) => (
                                <div
                                    className="flex h-8 items-center border border-border/80 bg-card px-1.5 motion-reveal"
                                    key={`${column.key}-${taskIndex}`}
                                    style={{
                                        animationDelay: `${280 + columnIndex * 90 + taskIndex * 50}ms`,
                                        width: `${width * 100}%`,
                                    }}
                                >
                                    <span className="h-1 w-full bg-primary/25" />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <div className="relative border-t border-border px-3 py-2 font-mono text-meta text-muted-foreground sm:px-4">
                <span className="text-primary/80">$</span>{" "}
                {t("emptyPreview.prompt")}
                <span className="ml-0.5 inline-block h-3 w-1.5 translate-y-0.5 bg-primary/80 motion-safe:animate-pulse" />
            </div>
        </div>
    );
}
