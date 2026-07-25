import Skeleton from "react-loading-skeleton";

import { cn } from "@/shared/lib/utils";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/shared/shadcn/ui/card";

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
            className={cn("flex h-full min-h-0 flex-col gap-3 pt-2", className)}
            role="status"
        >
            <header className="shrink-0 border-b border-border px-12 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-baseline gap-2">
                        <h1 className="truncate text-sm font-semibold">
                            <Skeleton />
                        </h1>
                        <p className="truncate text-code text-muted-foreground">
                            <Skeleton />
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Skeleton />
                        <Skeleton />
                        <Skeleton />
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
        <div className="flex min-h-0 flex-1 gap-0">
            {COLUMN_CARD_COUNTS.map((cardCount, columnIndex) => (
                <div
                    className="flex h-full min-h-0 min-w-72 flex-1 shrink-0 flex-col gap-3 border-r border-border px-3 py-1 last:border-r-0"
                    key={columnIndex}
                >
                    <div className="flex items-center justify-between gap-2 px-1">
                        <p className="text-meta font-medium">
                            <Skeleton />
                        </p>
                        <span className="text-meta text-muted-foreground">
                            <Skeleton circle />
                        </span>
                    </div>
                    <div className="flex flex-1 flex-col gap-2">
                        {Array.from({ length: cardCount }, (_, cardIndex) => (
                            <Card aria-hidden key={cardIndex} size="sm">
                                <CardHeader className="gap-2">
                                    <CardTitle>
                                        <Skeleton />
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-ui text-muted-foreground">
                                        <Skeleton count={2} />
                                    </p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
