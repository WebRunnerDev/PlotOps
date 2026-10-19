import Skeleton from "react-loading-skeleton";

const ROW_COUNT = 8;

type TeamTasksLoadingProperties = {
    /** `page` includes the header and toolbar; `rows` is the list only. */
    variant?: "page" | "rows";
};

export function TeamTasksLoading({
    variant = "page",
}: TeamTasksLoadingProperties) {
    if (variant === "rows") {
        return (
            <div aria-busy="true" aria-live="polite" role="status">
                <RowsSkeleton />
            </div>
        );
    }

    return (
        <div
            aria-busy="true"
            aria-live="polite"
            className="flex flex-col gap-6 px-4 py-8"
            role="status"
        >
            <div className="flex flex-col gap-1">
                <Skeleton width={120} />
                <Skeleton height={32} width={220} />
                <Skeleton width={280} />
            </div>
            <div className="flex flex-wrap gap-2">
                <Skeleton height={28} width={112} />
                <Skeleton height={28} width={128} />
                <Skeleton height={28} width={96} />
                <Skeleton height={28} width={144} />
            </div>
            <RowsSkeleton />
        </div>
    );
}

function RowsSkeleton() {
    return (
        <ul
            aria-hidden
            className="flex flex-col border-x border-t border-border bg-card"
        >
            {Array.from({ length: ROW_COUNT }, (_, index) => (
                <li
                    className="flex items-center gap-3 border-b border-border px-3 py-2.5"
                    key={index}
                >
                    <Skeleton width={72} />
                    <div className="min-w-0 flex-1">
                        <Skeleton />
                    </div>
                    <div className="hidden lg:block">
                        <Skeleton width={96} />
                    </div>
                    <div className="hidden lg:block">
                        <Skeleton width={72} />
                    </div>
                    <Skeleton width={56} />
                </li>
            ))}
        </ul>
    );
}
