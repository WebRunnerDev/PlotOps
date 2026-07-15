/** Formats ISO `YYYY-MM-DD` for compact card/chip display. */
export function formatDeadline(isoDate: string, locale?: string): string {
    const date = parseIsoDate(isoDate);
    if (!date) return isoDate;

    return new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "short",
    }).format(date);
}

export function isDeadlineOverdue(isoDate: string, now = new Date()): boolean {
    const date = parseIsoDate(isoDate);
    if (!date) return false;

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return date < today;
}

function parseIsoDate(isoDate: string): Date | undefined {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
    if (!match) return undefined;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day);
    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        return undefined;
    }
    return date;
}
