/** Bucket OHLC rows into fewer candles while preserving high/low extremes. */
export function decimateOhlcData<T extends Record<string, unknown>>(
    data: T[],
    maxPoints: number
): T[] {
    const length_ = data.length;
    if (maxPoints >= length_ || maxPoints < 2) {
        return data;
    }

    const bucketSize = length_ / maxPoints;
    const sampled: T[] = [];

    for (let index = 0; index < maxPoints; index++) {
        const start = Math.floor(index * bucketSize);
        const end = Math.min(length_, Math.floor((index + 1) * bucketSize));
        if (start >= end) {
            continue;
        }

        const bucket = data.slice(start, end);
        const first = bucket[0] as T;
        const last = bucket.at(-1) as T;

        let high = Number.NEGATIVE_INFINITY;
        let low = Number.POSITIVE_INFINITY;
        for (const row of bucket) {
            const rowHigh = row.high;
            const rowLow = row.low;
            if (typeof rowHigh === "number" && rowHigh > high) {
                high = rowHigh;
            }
            if (typeof rowLow === "number" && rowLow < low) {
                low = rowLow;
            }
        }

        sampled.push({
            ...last,
            close: last.close,
            high: Number.isFinite(high) ? high : last.high,
            low: Number.isFinite(low) ? low : last.low,
            open: first.open,
        } as T);
    }

    return sampled;
}

export function decimateTimeSeries<T extends Record<string, unknown>>(
    data: T[],
    maxPoints: number,
    valueKeys: string[] = []
): T[] {
    const length_ = data.length;
    if (maxPoints >= length_ || maxPoints < 3) {
        return data;
    }

    const getY = (point: T, index: number): number => {
        if (valueKeys.length === 0) {
            for (const value of Object.values(point)) {
                if (typeof value === "number") {
                    return value;
                }
            }
            return index;
        }

        let sum = 0;
        let count = 0;
        for (const key of valueKeys) {
            const value = point[key];
            if (typeof value === "number") {
                sum += value;
                count++;
            }
        }
        return count > 0 ? sum / count : index;
    };

    const sampled: T[] = [data[0] as T];
    const bucketSize = (length_ - 2) / (maxPoints - 2);
    let previousIndex = 0;

    for (let index = 0; index < maxPoints - 2; index++) {
        const rangeStart = Math.floor((index + 1) * bucketSize) + 1;
        const rangeEnd = Math.min(
            Math.floor((index + 2) * bucketSize) + 1,
            length_ - 1
        );

        const nextRangeStart = Math.floor((index + 2) * bucketSize) + 1;
        const nextRangeEnd = Math.min(
            Math.floor((index + 3) * bucketSize) + 1,
            length_
        );
        const nextCount = Math.max(0, nextRangeEnd - nextRangeStart);

        let avgX = length_ - 1;
        let avgY = getY(data[length_ - 1] as T, length_ - 1);
        if (nextCount > 0) {
            avgX = 0;
            avgY = 0;
            for (let index = nextRangeStart; index < nextRangeEnd; index++) {
                avgX += index;
                avgY += getY(data[index] as T, index);
            }
            avgX /= nextCount;
            avgY /= nextCount;
        }

        const pointA = data[previousIndex] as T;
        const ax = previousIndex;
        const ay = getY(pointA, previousIndex);

        let maxArea = -1;
        let maxIndex = rangeStart;

        for (let index = rangeStart; index < rangeEnd; index++) {
            const area =
                Math.abs(
                    (ax - avgX) * (getY(data[index] as T, index) - ay) -
                        (ax - index) * (avgY - ay)
                ) * 0.5;
            if (area > maxArea) {
                maxArea = area;
                maxIndex = index;
            }
        }

        sampled.push(data[maxIndex] as T);
        previousIndex = maxIndex;
    }

    sampled.push(data[length_ - 1] as T);
    return sampled;
}

/** ~1.5 points per pixel — enough for crisp curves without over-drawing. */
export function maxRenderPointsForWidth(innerWidth: number): number {
    return Math.max(64, Math.ceil(innerWidth * 1.5));
}
