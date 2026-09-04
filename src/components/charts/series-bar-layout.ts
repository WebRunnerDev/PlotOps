/** Half-width of the bar group at each x — used to pad reveal clips. */
export function computeSeriesBarRevealClipPadding(input: {
    barWidth: number;
    gap?: number;
    seriesCount: number;
    stacked?: boolean;
}): number {
    const { barWidth, gap = 4, seriesCount, stacked = false } = input;

    if (stacked || seriesCount <= 1) {
        return Math.ceil(barWidth / 2);
    }

    const groupWidth = seriesCount * barWidth + (seriesCount - 1) * gap;
    return Math.ceil(groupWidth / 2);
}

export function computeSeriesBarWidth(input: {
    columnWidth: number;
    composedBarGap?: number;
    composedBarSize?: number;
    composedMaxBarSize?: number;
    dataLength: number;
    innerWidth: number;
    seriesCount: number;
    stacked?: boolean;
}): number {
    const {
        columnWidth,
        composedBarGap = 4,
        composedBarSize,
        composedMaxBarSize,
        dataLength,
        innerWidth,
        seriesCount,
        stacked = false,
    } = input;

    const gap = composedBarGap;
    const groupCount = stacked ? 1 : Math.max(1, seriesCount);
    let slot = columnWidth;
    if (slot <= 0) {
        slot = dataLength < 2 ? innerWidth : innerWidth / (dataLength - 1);
    }

    let width =
        composedBarSize ??
        Math.min(slot * 0.88, composedMaxBarSize ?? Number.POSITIVE_INFINITY);
    if (composedMaxBarSize != undefined) {
        width = Math.min(width, composedMaxBarSize);
    }
    if (groupCount > 1) {
        const maxGroup = slot * 0.92;
        const needed = groupCount * width + (groupCount - 1) * gap;
        if (needed > maxGroup && maxGroup > 0) {
            width = Math.max(
                4,
                (maxGroup - (groupCount - 1) * gap) / groupCount
            );
        }
    }

    return Math.max(2, width);
}
