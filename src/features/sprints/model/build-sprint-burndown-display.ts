import type { SprintBurndownSeries } from "./build-sprint-burndown-series";

export type SprintBurndownDisplayPoint = {
    completedCumulative: number;
    date: Date;
    ideal: number;
    idealCompleted: number;
    remaining: number;
    scope: number;
};

/**
 * Turn the raw daily series into a readable chart:
 * - drop empty post-close calendar days (closed early)
 * - synthesize an open→close cliff when Close lands on day 1
 */
export function buildSprintBurndownDisplayPoints(
    series: SprintBurndownSeries,
    mode: "active" | "closed"
): SprintBurndownDisplayPoint[] {
    const measured = series.days
        .filter((day) => day.remaining !== null)
        .map((day) => ({
            completedCumulative: day.completedCumulative ?? 0,
            date: parseIsoDateLocal(day.date),
            ideal: day.ideal,
            idealCompleted: day.idealCompleted,
            remaining: day.remaining ?? 0,
            scope: day.scope ?? 0,
        }));

    if (measured.length === 0) {
        return [];
    }

    let points = measured;
    if (mode === "closed") {
        points = trimTrailingFlatTail(points);
    }

    const first = points[0];
    const remainingIsFlat =
        points.length === 1 ||
        points.every((point) => point.remaining === first?.remaining);
    if (
        first &&
        series.commitmentTotal > 0 &&
        first.remaining < series.commitmentTotal &&
        remainingIsFlat
    ) {
        return [
            {
                completedCumulative: 0,
                date: startOfLocalDay(first.date),
                ideal: series.commitmentTotal,
                idealCompleted: 0,
                remaining: series.commitmentTotal,
                scope: first.scope || series.commitmentTotal,
            },
            {
                ...first,
                date: endOfLocalDay(first.date),
            },
        ];
    }

    if (points.length === 1 && first) {
        return [
            {
                ...first,
                date: startOfLocalDay(first.date),
            },
            {
                ...first,
                date: endOfLocalDay(first.date),
            },
        ];
    }

    return points;
}

function endOfLocalDay(value: Date): Date {
    return new Date(
        value.getFullYear(),
        value.getMonth(),
        value.getDate(),
        23,
        59,
        0,
        0
    );
}

function parseIsoDateLocal(isoDate: string): Date {
    const [year, month, day] = isoDate.split("-").map(Number);
    return new Date(year!, month! - 1, day!);
}

function startOfLocalDay(value: Date): Date {
    return new Date(
        value.getFullYear(),
        value.getMonth(),
        value.getDate(),
        0,
        0,
        0,
        0
    );
}

/** Keep through the last day remaining/scope/completed changed; drop flat calendar padding. */
function trimTrailingFlatTail(
    points: SprintBurndownDisplayPoint[]
): SprintBurndownDisplayPoint[] {
    if (points.length <= 2) {
        return points;
    }

    let lastChange = 0;
    for (let index = 1; index < points.length; index += 1) {
        const previous = points[index - 1]!;
        const current = points[index]!;
        if (
            current.remaining !== previous.remaining ||
            current.scope !== previous.scope ||
            current.completedCumulative !== previous.completedCumulative
        ) {
            lastChange = index;
        }
    }

    return points.slice(0, Math.max(lastChange + 1, 2));
}
