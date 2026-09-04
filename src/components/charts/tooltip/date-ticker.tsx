"use client";

import { motion, useSpring } from "motion/react";
import { memo, useMemo, useRef } from "react";

const TICKER_ITEM_HEIGHT = 24;
/** Full scroll stacks are skipped above this count — single label + instant updates. */
const COMPACT_TICKER_THRESHOLD = 60;

export interface DateTickerProperties {
    currentIndex: number;
    labels: string[];
    visible: boolean;
}

const DateTickerCompact = memo(function DateTickerCompact({
    currentIndex,
    labels,
}: Omit<DateTickerProperties, "visible">) {
    const label = labels[currentIndex] ?? labels[0] ?? "";

    return (
        <div className="overflow-hidden rounded-full bg-zinc-900 px-4 py-1 text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900">
            <div className="flex h-6 items-center justify-center">
                <span className="whitespace-nowrap font-medium text-sm">
                    {label}
                </span>
            </div>
        </div>
    );
});

const DateTickerInner = memo(function DateTickerInner({
    currentIndex,
    labels,
}: Omit<DateTickerProperties, "visible">) {
    // Parse labels into month and day parts
    const parsedLabels = useMemo(() => {
        return labels.map((label, index) => {
            const parts = label.split(" ");
            const month = parts[0] || "";
            const day = parts[1] || "";
            return { day, full: label, key: `${label}::${index}`, month };
        });
    }, [labels]);

    // Month segments: one entry per consecutive run (Jan → Feb → …), keyed by start index
    const monthSegments = useMemo(() => {
        const segments: { key: string; month: string; startIndex: number }[] =
            [];

        for (const [index, label] of parsedLabels.entries()) {
            const previous = segments.at(-1);
            if (!previous || previous.month !== label.month) {
                segments.push({
                    key: `${label.month}-${index}`,
                    month: label.month,
                    startIndex: index,
                });
            }
        }

        return segments;
    }, [parsedLabels]);

    // Index into monthSegments for the current data point
    const currentMonthIndex = useMemo(() => {
        if (currentIndex < 0 || currentIndex >= parsedLabels.length) {
            return 0;
        }
        for (let index = monthSegments.length - 1; index >= 0; index--) {
            const segment = monthSegments[index];
            if (segment && segment.startIndex <= currentIndex) {
                return index;
            }
        }
        return 0;
    }, [currentIndex, parsedLabels.length, monthSegments]);

    // Track previous month index
    const previousMonthIndexReference = useRef(-1);

    // Animated Y offsets
    const dayY = useSpring(0, { damping: 35, stiffness: 400 });
    const monthY = useSpring(0, { damping: 35, stiffness: 400 });

    dayY.set(-currentIndex * TICKER_ITEM_HEIGHT);

    if (currentMonthIndex >= 0) {
        const isFirstRender = previousMonthIndexReference.current === -1;
        const monthChanged =
            previousMonthIndexReference.current !== currentMonthIndex;
        if (isFirstRender || monthChanged) {
            monthY.set(-currentMonthIndex * TICKER_ITEM_HEIGHT);
            previousMonthIndexReference.current = currentMonthIndex;
        }
    }

    return (
        <div className="overflow-hidden rounded-full bg-zinc-900 px-4 py-1 text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900">
            <div className="relative h-6 overflow-hidden">
                <div className="flex items-center justify-center gap-1">
                    {/* Month stack */}
                    <div className="relative h-6 overflow-hidden">
                        <motion.div
                            className="flex flex-col"
                            style={{ y: monthY }}
                        >
                            {monthSegments.map((segment) => (
                                <div
                                    className="flex h-6 shrink-0 items-center justify-center"
                                    key={segment.key}
                                >
                                    <span className="whitespace-nowrap font-medium text-sm">
                                        {segment.month}
                                    </span>
                                </div>
                            ))}
                        </motion.div>
                    </div>

                    {/* Day stack */}
                    <div className="relative h-6 overflow-hidden">
                        <motion.div
                            className="flex flex-col"
                            style={{ y: dayY }}
                        >
                            {parsedLabels.map((label) => (
                                <div
                                    className="flex h-6 shrink-0 items-center justify-center"
                                    key={label.key}
                                >
                                    <span className="whitespace-nowrap font-medium text-sm">
                                        {label.day}
                                    </span>
                                </div>
                            ))}
                        </motion.div>
                    </div>
                </div>
            </div>
        </div>
    );
});

export function DateTicker({
    currentIndex,
    labels,
    visible,
}: DateTickerProperties) {
    if (!visible || labels.length === 0) {
        return null;
    }

    if (labels.length > COMPACT_TICKER_THRESHOLD) {
        return (
            <DateTickerCompact currentIndex={currentIndex} labels={labels} />
        );
    }

    return <DateTickerInner currentIndex={currentIndex} labels={labels} />;
}

DateTicker.displayName = "DateTicker";

export default DateTicker;
