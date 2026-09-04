import Skeleton from "react-loading-skeleton";

const SUMMARY_CELL_COUNT = 3;
const FILTER_COUNT = 3;
const BUILD_ROW_COUNT = 4;

export function CiCdLoading() {
    return (
        <div
            aria-busy="true"
            aria-live="polite"
            className="scrollbar-board relative mx-auto flex h-full w-full min-w-0 max-w-5xl flex-col gap-8 overflow-y-auto px-4 py-8 sm:gap-10 sm:py-10"
            role="status"
        >
            <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 -top-8 h-80 bg-auth-atmosphere opacity-90 sm:-top-10 sm:h-112"
            />

            <header className="relative flex min-w-0 flex-col gap-4">
                <Skeleton height={12} width={72} />
                <Skeleton height={56} width={180} />
                <Skeleton height={2} width={56} />
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                    <Skeleton height={14} width={160} />
                    <Skeleton height={40} width={220} />
                </div>
            </header>

            <div
                aria-hidden
                className="relative grid gap-5 border border-border border-l-2 border-l-border bg-card/50 p-4 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] sm:gap-8 sm:p-6"
            >
                <div className="flex flex-col gap-2">
                    <Skeleton height={12} width={72} />
                    <Skeleton height={36} width={120} />
                </div>
                <div className="flex flex-col gap-2.5">
                    <Skeleton height={22} width={160} />
                    <Skeleton height={22} width={100} />
                    <Skeleton height={14} width="70%" />
                    <Skeleton height={12} width={140} />
                </div>
            </div>

            <section
                aria-hidden
                className="relative grid grid-cols-1 gap-px border border-border bg-border sm:grid-cols-3"
            >
                {Array.from({ length: SUMMARY_CELL_COUNT }, (_, index) => (
                    <div
                        className="flex min-w-0 flex-col items-start gap-2.5 bg-card/60 px-4 py-4 sm:px-5 sm:py-5"
                        key={index}
                    >
                        <Skeleton height={12} width={88} />
                        <Skeleton height={40} width={56} />
                    </div>
                ))}
            </section>

            <div
                aria-hidden
                className="relative flex flex-wrap gap-1 border border-border bg-card/40 p-1"
            >
                {Array.from({ length: FILTER_COUNT }, (_, index) => (
                    <Skeleton
                        containerClassName="flex-1"
                        height={40}
                        key={index}
                        width="100%"
                    />
                ))}
            </div>

            <div className="relative flex flex-col gap-3">
                <Skeleton height={12} width={64} />
                <ul
                    aria-hidden
                    className="divide-y divide-border border border-border"
                >
                    {Array.from({ length: BUILD_ROW_COUNT }, (_, index) => (
                        <li
                            className="flex flex-col gap-2 border-l-2 border-l-border bg-card/25 px-3 py-3.5"
                            key={index}
                        >
                            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2.5">
                                    <Skeleton height={16} width={140} />
                                    <Skeleton height={22} width={96} />
                                </div>
                                <Skeleton height={22} width={80} />
                            </div>
                            <Skeleton height={14} width="65%" />
                            <Skeleton height={12} width={120} />
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
