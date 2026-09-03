export interface SquareColumnInput {
    /** Raw bar length in pixels (baseline − value) */
    barLengthPx: number;
    /** When true, redistribute gap so column height matches barLengthPx exactly */
    fit?: boolean;
    /** Gap between stacked squares in pixels */
    gap: number;
    /** Square width/height — typically equals bar width */
    squareSize: number;
}

export interface SquareColumnLayout {
    /** Quantized column height in pixels */
    columnHeight: number;
    /** Number of squares in the column */
    count: number;
    /** Effective gap between squares (may differ when fit mode redistributes) */
    gap: number;
    /** Top-left Y of each square, bottom square first (relative to bar top at 0) */
    positions: number[];
    squareSize: number;
}

/** Quantize bar length into a stack of square cells. */
export function computeSquareColumn({
    barLengthPx,
    fit = false,
    gap,
    squareSize,
}: SquareColumnInput): SquareColumnLayout {
    if (barLengthPx <= 0 || squareSize <= 0) {
        return { columnHeight: 0, count: 0, gap, positions: [], squareSize };
    }

    if (fit) {
        const count = Math.max(
            1,
            Math.floor((barLengthPx + gap) / (squareSize + gap))
        );
        const effectiveGap =
            count > 1
                ? Math.max(0, (barLengthPx - count * squareSize) / (count - 1))
                : 0;
        const step = squareSize + effectiveGap;
        const columnHeight = barLengthPx;
        const positions: number[] = [];

        for (let index = 0; index < count; index++) {
            positions.push(columnHeight - squareSize - index * step);
        }

        return {
            columnHeight,
            count,
            gap: effectiveGap,
            positions,
            squareSize,
        };
    }

    const step = squareSize + gap;
    const count = Math.max(1, Math.round(barLengthPx / step));
    const columnHeight = count * squareSize + Math.max(0, count - 1) * gap;

    const positions: number[] = [];
    for (let index = 0; index < count; index++) {
        const offsetFromBottom = index * step;
        positions.push(columnHeight - squareSize - offsetFromBottom);
    }

    return { columnHeight, count, gap, positions, squareSize };
}

/** Y center of the topmost square in a vertical column. */
export function topSquareCenterY({
    barLengthPx,
    baselineY,
    fit = false,
    gap,
    squareSize,
}: SquareColumnInput & { baselineY: number }): number {
    const {
        columnHeight,
        count,
        squareSize: size,
    } = computeSquareColumn({
        barLengthPx,
        fit,
        gap,
        squareSize,
    });

    if (count === 0) {
        return baselineY;
    }

    const topY = baselineY - columnHeight;
    return topY + size / 2;
}
