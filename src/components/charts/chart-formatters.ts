/**
 * Chart formatters follow the app language: `src/app/i18n.ts` keeps
 * `<html lang>` in sync with i18next, so axes and tooltips read "13 нояб."
 * in Russian and "Nov 13" in English. Outside a browser (SSG) they fall
 * back to en-US. One `Intl` instance is cached per locale.
 */
const FALLBACK_LOCALE = "en-US";

function documentLocale(): string {
    if (typeof document === "undefined") return FALLBACK_LOCALE;
    return document.documentElement.lang || FALLBACK_LOCALE;
}

function localeDateFormat(options: Intl.DateTimeFormatOptions) {
    const cache = new Map<string, Intl.DateTimeFormat>();
    return {
        format(value: Date | number): string {
            const locale = documentLocale();
            let formatter = cache.get(locale);
            if (!formatter) {
                formatter = new Intl.DateTimeFormat(locale, options);
                cache.set(locale, formatter);
            }
            return formatter.format(value);
        },
    };
}

export const shortDateFmt = localeDateFormat({
    day: "numeric",
    month: "short",
});

export const weekdayDateFmt = localeDateFormat({
    day: "numeric",
    month: "short",
    weekday: "short",
});

export const hmsTimeFmt = localeDateFormat({
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    second: "2-digit",
});

const numberFormats = new Map<string, Intl.NumberFormat>();

export function intFmt(value: number): string {
    const locale = documentLocale();
    let formatter = numberFormats.get(locale);
    if (!formatter) {
        formatter = new Intl.NumberFormat(locale);
        numberFormats.set(locale, formatter);
    }
    return formatter.format(value);
}
