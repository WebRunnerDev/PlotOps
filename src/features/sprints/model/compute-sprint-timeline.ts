export type SprintTimeline = {
    daysElapsed: null | number;
    daysRemaining: null | number;
    phase: SprintTimelinePhase;
    /** 0–1 calendar progress through the sprint window; null when undated. */
    progress01: null | number;
    totalDays: null | number;
};

export type SprintTimelinePhase = "active" | "overdue" | "undated" | "upcoming";

type ComputeSprintTimelineInput = {
    endsOn: null | string | undefined;
    startsOn: null | string | undefined;
    /** Local calendar YYYY-MM-DD. */
    today: string;
};

/**
 * Inclusive calendar window for an Active sprint strip.
 * `progress01` is elapsed / (totalDays - 1) so a multi-day sprint hits 1 on endsOn.
 * Single-day windows report progress01 = 1 when today is that day.
 */
export function computeSprintTimeline({
    endsOn,
    startsOn,
    today,
}: ComputeSprintTimelineInput): SprintTimeline {
    if (!startsOn || !endsOn) {
        return {
            daysElapsed: null,
            daysRemaining: null,
            phase: "undated",
            progress01: null,
            totalDays: null,
        };
    }

    const startMs = parseIsoDateUtc(startsOn);
    const endMs = parseIsoDateUtc(endsOn);
    const todayMs = parseIsoDateUtc(today);
    if (
        startMs === null ||
        endMs === null ||
        todayMs === null ||
        endMs < startMs
    ) {
        return {
            daysElapsed: null,
            daysRemaining: null,
            phase: "undated",
            progress01: null,
            totalDays: null,
        };
    }

    const dayMs = 86_400_000;
    const totalDays = Math.floor((endMs - startMs) / dayMs) + 1;

    if (todayMs < startMs) {
        const daysRemaining = Math.floor((endMs - todayMs) / dayMs);
        return {
            daysElapsed: 0,
            daysRemaining,
            phase: "upcoming",
            progress01: 0,
            totalDays,
        };
    }

    if (todayMs > endMs) {
        return {
            daysElapsed: totalDays,
            daysRemaining: 0,
            phase: "overdue",
            progress01: 1,
            totalDays,
        };
    }

    const daysElapsed = Math.floor((todayMs - startMs) / dayMs);
    const daysRemaining = Math.floor((endMs - todayMs) / dayMs);
    const progress01 =
        totalDays <= 1 ? 1 : Math.min(1, daysElapsed / (totalDays - 1));

    return {
        daysElapsed,
        daysRemaining,
        phase: "active",
        progress01,
        totalDays,
    };
}

function parseIsoDateUtc(iso: string): null | number {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    return Date.UTC(year, month - 1, day);
}
