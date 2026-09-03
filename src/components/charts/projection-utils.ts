export interface BuildProjectionPathOptions {
    autoMethod?: ProjectionAutoMethod;
    /** Target Y at the final projected date (target mode). */
    endValue?: number;
    /** How many future points to generate (matches source cadence). */
    horizonPoints?: number;
    mode: ProjectionMode;
    /** Auto mode: stepped points per interval, or anchor + end only. Default: stepped */
    pathDensity?: ProjectionPathDensity;
    /** Full manual path — anchor + future points (manual mode). */
    points?: ProjectionPoint[];
    seriesKey: string;
    sourceData: Record<string, unknown>[];
    /** Index in sourceData where projection anchors (default: last point). */
    startIndex?: number;
    xDataKey?: string;
}
export type ProjectionAutoMethod = "lastSegment" | "linearRegression";
/** How the projection segment is drawn between anchor and horizon. */
export type ProjectionCurveKind = "bezier" | "linear";
export type ProjectionMode = "auto" | "manual" | "target";

/** @deprecated Stepped density removed — projections always anchor → horizon. */
export type ProjectionPathDensity = "endpoints" | "stepped";

export interface ProjectionPoint {
    date: Date;
    value: number;
}

/** Cubic bezier with horizontal tangents at start and end (price-target S-curve). */
export function buildHorizontalTangentBezierPath(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    /** How far control points sit along the x span (0–0.5). Default: 0.45 */
    tension = 0.45
): string {
    const dx = x1 - x0;
    if (Math.abs(dx) < 1e-6) {
        return `M ${x0},${y0} L ${x1},${y1}`;
    }
    const t = Math.min(0.5, Math.max(0.05, tension));
    const c1x = x0 + dx * t;
    const c2x = x1 - dx * t;
    return `M ${x0},${y0} C ${c1x},${y0} ${c2x},${y1} ${x1},${y1}`;
}

/** Build a projection path from historical chart data or explicit points. */
export function buildProjectionPath(
    options: BuildProjectionPathOptions
): ProjectionPoint[] {
    const {
        autoMethod = "linearRegression",
        endValue,
        horizonPoints = 6,
        mode,
        pathDensity = "endpoints",
        points,
        seriesKey,
        sourceData,
        startIndex: startIndexProperty,
        xDataKey = "date",
    } = options;

    if (mode === "manual" && points && points.length >= 2) {
        return points.map((point) => ({
            date: new Date(point.date),
            value: point.value,
        }));
    }

    if (sourceData.length === 0) {
        return [];
    }

    const startIndex = resolveStartIndex(sourceData, startIndexProperty);
    const anchorRow = sourceData[startIndex];
    if (!anchorRow) {
        return [];
    }

    const anchorDate = readDate(anchorRow, xDataKey);
    const anchorValue = readValue(anchorRow, seriesKey);
    if (!anchorDate || anchorValue == undefined) {
        return [];
    }

    const intervalMs = resolveIntervalMs(sourceData, xDataKey, startIndex);
    const anchorTime = anchorDate.getTime();

    const historyPoints: { t: number; y: number }[] = [];
    for (let index = 0; index <= startIndex; index++) {
        const row = sourceData[index];
        if (!row) {
            continue;
        }
        const date = readDate(row, xDataKey);
        const value = readValue(row, seriesKey);
        if (date && value != undefined) {
            historyPoints.push({ t: date.getTime(), y: value });
        }
    }

    if (
        mode === "target" &&
        endValue != undefined &&
        Number.isFinite(endValue)
    ) {
        return buildTargetPath({
            anchorTime,
            anchorValue,
            endValue,
            horizonPoints,
            intervalMs,
        });
    }

    return buildAutoFutureValues({
        anchorTime,
        anchorValue,
        autoMethod,
        historyPoints,
        horizonPoints,
        intervalMs,
        pathDensity,
    });
}

/** Slope (value change per ms) at the projection anchor from the last data segment. */
export function computeProjectionAnchorTangentSlope(
    sourceData: Record<string, unknown>[],
    seriesKey: string,
    xDataKey = "date",
    startIndexProperty?: number
): number {
    if (sourceData.length < 2) {
        return 0;
    }
    const startIndex = resolveStartIndex(sourceData, startIndexProperty);
    const historyPoints: { t: number; y: number }[] = [];
    for (let index = 0; index <= startIndex; index++) {
        const row = sourceData[index];
        if (!row) {
            continue;
        }
        const date = readDate(row, xDataKey);
        const value = readValue(row, seriesKey);
        if (date && value != undefined) {
            historyPoints.push({ t: date.getTime(), y: value });
        }
    }
    if (historyPoints.length < 2) {
        return 0;
    }
    const previous = historyPoints.at(-2);
    const last = historyPoints.at(-1);
    if (!(previous && last)) {
        return 0;
    }
    const dt = last.t - previous.t;
    return dt === 0 ? 0 : (last.y - previous.y) / dt;
}

/** Collect date extents from projection point arrays. */
export function projectionDateExtents(
    paths: ProjectionPoint[][]
): null | { maxTime: number; minTime: number } {
    let minTime = Number.POSITIVE_INFINITY;
    let maxTime = Number.NEGATIVE_INFINITY;

    for (const path of paths) {
        for (const point of path) {
            const time = point.date.getTime();
            if (time < minTime) {
                minTime = time;
            }
            if (time > maxTime) {
                maxTime = time;
            }
        }
    }

    if (minTime === Number.POSITIVE_INFINITY) {
        return null;
    }

    return { maxTime, minTime };
}

/** Collect numeric Y extents from projection point arrays. */
export function projectionValueExtents(
    paths: ProjectionPoint[][]
): null | { maxValue: number; minValue: number } {
    let minValue = Number.POSITIVE_INFINITY;
    let maxValue = Number.NEGATIVE_INFINITY;

    for (const path of paths) {
        for (const point of path) {
            if (point.value < minValue) {
                minValue = point.value;
            }
            if (point.value > maxValue) {
                maxValue = point.value;
            }
        }
    }

    if (minValue === Number.POSITIVE_INFINITY) {
        return null;
    }

    return { maxValue, minValue };
}

function buildAutoFutureValues(options: {
    anchorTime: number;
    anchorValue: number;
    autoMethod: ProjectionAutoMethod;
    historyPoints: { t: number; y: number }[];
    horizonPoints: number;
    intervalMs: number;
    pathDensity: ProjectionPathDensity;
}): ProjectionPoint[] {
    const {
        anchorTime,
        anchorValue,
        autoMethod,
        historyPoints,
        horizonPoints,
        intervalMs,
        pathDensity,
    } = options;

    const slope =
        autoMethod === "lastSegment" && historyPoints.length >= 2
            ? (() => {
                  const previous = historyPoints.at(-2);
                  const last = historyPoints.at(-1);
                  if (!(previous && last)) {
                      return 0;
                  }
                  const dt = last.t - previous.t;
                  return dt === 0 ? 0 : (last.y - previous.y) / dt;
              })()
            : linearRegressionSlope(historyPoints);

    if (pathDensity === "endpoints") {
        const endTime = anchorTime + intervalMs * horizonPoints;
        const endValue = anchorValue + slope * intervalMs * horizonPoints;
        return [
            { date: new Date(anchorTime), value: anchorValue },
            { date: new Date(endTime), value: endValue },
        ];
    }

    const result: ProjectionPoint[] = [
        { date: new Date(anchorTime), value: anchorValue },
    ];

    for (let index = 1; index <= horizonPoints; index++) {
        const t = anchorTime + intervalMs * index;
        const value = anchorValue + slope * intervalMs * index;
        result.push({ date: new Date(t), value });
    }

    return result;
}

function buildTargetPath(options: {
    anchorTime: number;
    anchorValue: number;
    endValue: number;
    horizonPoints: number;
    intervalMs: number;
}): ProjectionPoint[] {
    const { anchorTime, anchorValue, endValue, horizonPoints, intervalMs } =
        options;
    const endTime = anchorTime + intervalMs * horizonPoints;
    return [
        { date: new Date(anchorTime), value: anchorValue },
        { date: new Date(endTime), value: endValue },
    ];
}

function intervalFromAdjacentRows(
    sourceData: Record<string, unknown>[],
    xDataKey: string,
    startIndex: number
): null | number {
    if (startIndex < 1) {
        return null;
    }
    const previousRow = sourceData[startIndex - 1];
    const currentRow = sourceData[startIndex];
    const previous = previousRow ? readDate(previousRow, xDataKey) : null;
    const current = currentRow ? readDate(currentRow, xDataKey) : null;
    if (!(previous && current)) {
        return null;
    }
    const delta = current.getTime() - previous.getTime();
    return delta > 0 ? delta : null;
}

function intervalFromSeriesSpan(
    sourceData: Record<string, unknown>[],
    xDataKey: string
): null | number {
    if (sourceData.length < 2) {
        return null;
    }
    const firstRow = sourceData[0];
    const lastRow = sourceData.at(-1);
    const first = firstRow ? readDate(firstRow, xDataKey) : null;
    const last = lastRow ? readDate(lastRow, xDataKey) : null;
    if (!(first && last)) {
        return null;
    }
    const span = last.getTime() - first.getTime();
    return span > 0 ? span / (sourceData.length - 1) : null;
}

function linearRegressionSlope(points: { t: number; y: number }[]): number {
    if (points.length < 2) {
        return 0;
    }
    const n = points.length;
    let sumT = 0;
    let sumY = 0;
    let sumTY = 0;
    let sumTT = 0;
    for (const { t, y } of points) {
        sumT += t;
        sumY += y;
        sumTY += t * y;
        sumTT += t * t;
    }
    const denom = n * sumTT - sumT * sumT;
    if (Math.abs(denom) < 1e-12) {
        return 0;
    }
    return (n * sumTY - sumT * sumY) / denom;
}

function readDate(row: Record<string, unknown>, xDataKey: string): Date | null {
    const raw = row[xDataKey];
    if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
        return raw;
    }
    if (typeof raw === "number" && Number.isFinite(raw)) {
        const date = new Date(raw);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    if (typeof raw === "string") {
        const date = new Date(raw);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    return null;
}

function readValue(
    row: Record<string, unknown>,
    seriesKey: string
): null | number {
    const raw = row[seriesKey];
    return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
}

function resolveIntervalMs(
    sourceData: Record<string, unknown>[],
    xDataKey: string,
    startIndex: number
): number {
    return (
        intervalFromAdjacentRows(sourceData, xDataKey, startIndex) ??
        intervalFromSeriesSpan(sourceData, xDataKey) ??
        86_400_000
    );
}

function resolveStartIndex(
    sourceData: Record<string, unknown>[],
    startIndex: number | undefined
): number {
    if (startIndex == undefined || !Number.isFinite(startIndex)) {
        return Math.max(0, sourceData.length - 1);
    }
    return Math.min(Math.max(0, Math.floor(startIndex)), sourceData.length - 1);
}
