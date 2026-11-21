import { formatDistanceStrict } from "date-fns";
import { enUS, ru } from "date-fns/locale";

const MINUTE_MS = 60_000;
const WEEK_MS = 7 * 24 * 60 * MINUTE_MS;

/** Full date and time for a tooltip / `<time title>`. */
export function formatNotificationAbsoluteTime(
    createdAt: string,
    locale: string
): string {
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date);
}

/**
 * Short relative time for an inbox row: `justNowLabel` under a minute,
 * "5 minutes ago" within a week, then a calendar date.
 */
export function formatNotificationRelativeTime(
    createdAt: string,
    input: { justNowLabel: string; locale: string; now?: Date }
): string {
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) return "";

    const now = input.now ?? new Date();
    const elapsedMs = now.getTime() - date.getTime();
    if (elapsedMs < MINUTE_MS) {
        return input.justNowLabel;
    }
    if (elapsedMs < WEEK_MS) {
        return formatDistanceStrict(date, now, {
            addSuffix: true,
            locale: input.locale.toLowerCase().startsWith("ru") ? ru : enUS,
        });
    }
    return new Intl.DateTimeFormat(input.locale, {
        day: "numeric",
        month: "short",
        ...(date.getFullYear() === now.getFullYear()
            ? {}
            : { year: "numeric" }),
    }).format(date);
}
