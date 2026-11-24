/**
 * Human date range for a Sprint window, e.g. "Aug 2 – Aug 15" or
 * "Dec 29, 2025 – Jan 9, 2026" when the window crosses a year or is not
 * in the current year. Inputs are local calendar YYYY-MM-DD strings.
 */
export function formatSprintDateRange(input: {
    endsOn?: null | string;
    locale?: string;
    startsOn?: null | string;
    today: string;
}): null | string {
    const start = parseIsoDate(input.startsOn);
    const end = parseIsoDate(input.endsOn);
    if (!start || !end) return null;

    const currentYear = Number(input.today.slice(0, 4));
    const showYear =
        start.getUTCFullYear() !== end.getUTCFullYear() ||
        end.getUTCFullYear() !== currentYear;
    const format = new Intl.DateTimeFormat(input.locale, {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
        ...(showYear ? { year: "numeric" } : {}),
    });
    return `${format.format(start)} – ${format.format(end)}`;
}

/** Short local date-time for report timestamps (ISO instant in). */
export function formatSprintTimestamp(iso: string, locale?: string): string {
    return new Intl.DateTimeFormat(locale, {
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        month: "short",
    }).format(new Date(iso));
}

function parseIsoDate(value?: null | string): Date | null {
    if (!value) return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;
    return new Date(
        Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    );
}
