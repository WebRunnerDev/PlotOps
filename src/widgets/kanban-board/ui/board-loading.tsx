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
            <header className="shrink-0 border-b border-primary/25 px-3 py-2 sm:px-12">
                <div className="flex flex-wrap items-center gap-2">
                    <Skeleton width={96} />
                    <Skeleton width={112} />
                    <Skeleton width={128} />
                    <Skeleton width={80} />
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
        <div className="flex min-h-0 flex-1 gap-1">
            {COLUMN_CARD_COUNTS.map((cardCount, columnIndex) => (
                <div
                    className="flex h-full min-h-0 min-w-72 flex-1 shrink-0 flex-col border border-border bg-card/50"
                    key={columnIndex}
                >
                    <div className="flex items-center gap-2 border-b border-border px-2.5 py-2">
                        <span
                            aria-hidden
                            className="size-2 shrink-0 bg-muted-foreground/40"
                        />
                        <p className="min-w-0 flex-1 text-meta font-medium">
                            <Skeleton />
                        </p>
                        <span className="text-meta text-muted-foreground">
                            <Skeleton circle width={14} />
                        </span>
                    </div>
                    <div className="flex flex-1 flex-col gap-px p-px">
                        {Array.from({ length: cardCount }, (_, cardIndex) => (
                            <Card
                                aria-hidden
                                className="rounded-none bg-background ring-1 ring-border"
                                key={cardIndex}
                                size="sm"
                            >
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
