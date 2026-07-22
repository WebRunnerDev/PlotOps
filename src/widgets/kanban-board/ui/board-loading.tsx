import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";
import { Skeleton } from "@/shared/shadcn/ui/skeleton";
import { Spinner } from "@/shared/shadcn/ui/spinner";

const COLUMN_CARD_COUNTS = [3, 2, 3, 1] as const;

type BoardLoadingProperties = {
    className?: string;
    /** `page` includes header chrome; `columns` is for in-board task fetch. */
    variant?: "columns" | "page";
};

export function BoardLoading({
    className,
    variant = "page",
}: BoardLoadingProperties) {
    if (variant === "columns") {
        return (
            <div
                aria-busy="true"
                aria-live="polite"
                className={cn("flex min-h-0 flex-1 flex-col", className)}
                role="status"
            >
                <BoardColumnsSkeleton />
            </div>
        );
    }

    return (
        <div
            aria-busy="true"
            aria-live="polite"
            className={cn(
                "flex h-full min-h-0 flex-col gap-4 pt-3 pb-24",
                className
            )}
            role="status"
        >
            <header className="shrink-0 border-b border-border px-12 py-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-2">
                        <Skeleton className="h-7 w-28" />
                        <div className="flex flex-col gap-1.5">
                            <Skeleton className="h-8 w-48" />
                            <Skeleton className="h-4 w-40" />
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Skeleton className="h-8 w-32" />
                        <Skeleton className="h-8 w-24" />
                        <Skeleton className="h-8 w-28" />
                    </div>
                </div>
            </header>

            <div className="min-h-0 flex-1 px-3">
                <BoardColumnsSkeleton />
            </div>
        </div>
    );
}

function BoardColumnsSkeleton() {
    return (
        <div className="relative flex min-h-0 flex-1 gap-0">
            {COLUMN_CARD_COUNTS.map((cardCount, columnIndex) => (
                <div
                    className="flex h-full min-h-0 min-w-72 flex-1 shrink-0 flex-col gap-3 border-r border-border px-3 py-1 last:border-r-0"
                    key={columnIndex}
                >
                    <div className="flex items-center justify-between gap-2 px-1">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="size-5 rounded-full" />
                    </div>
                    <div className="flex flex-1 flex-col gap-2">
                        {Array.from({ length: cardCount }, (_, cardIndex) => (
                            <Skeleton
                                className="h-20 w-full rounded-lg"
                                key={cardIndex}
                                style={{
                                    animationDelay: `${(columnIndex * 3 + cardIndex) * 80}ms`,
                                }}
                            />
                        ))}
                    </div>
                </div>
            ))}

            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/55 backdrop-blur-[1px]">
                <Spinner className="size-8 text-primary" />
                <BoardLoadingLabel />
            </div>
        </div>
    );
}

function BoardLoadingLabel() {
    const { t } = useTranslation("board");
    return <p className="text-ui text-muted-foreground">{t("loadingBoard")}</p>;
}
