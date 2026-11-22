import type { Locale } from "date-fns";

import { useRouter } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { enUS, ru } from "date-fns/locale";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { PLOTOPS_VERSION } from "@/shared/config/app-version";
import { PLOTOPS_GITHUB_URL } from "@/shared/config/open-source";
import { buildWhatsNewPageSeo } from "@/shared/lib/page-seo-config";
import { usePageSeo } from "@/shared/lib/use-page-seo";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/shadcn/ui/badge";
import { Button } from "@/shared/shadcn/ui/button";

import {
    latestPublishedVersion,
    resolveWhatsNewLocale,
    selectPublishedEntries,
} from "../model/published-entries";
import {
    WHATS_NEW_ENTRIES,
    type WhatsNewChangeKind,
    type WhatsNewEntry,
    type WhatsNewLocale,
} from "../model/releases";
import { useSeenReleaseStore } from "../model/seen-release-store";

const DATE_LOCALES: Record<WhatsNewLocale, Locale> = { en: enUS, ru };

const KIND_CLASS_NAMES: Record<WhatsNewChangeKind, string> = {
    fixed: "border-border text-muted-foreground",
    improved: "border-border text-foreground/80",
    new: "border-primary/50 bg-primary/10 text-primary",
};

export function WhatsNewPage() {
    const { i18n, t } = useTranslation(["whatsNew", "common"]);
    const router = useRouter();
    const locale = resolveWhatsNewLocale(i18n.language);
    const entries = selectPublishedEntries(WHATS_NEW_ENTRIES, PLOTOPS_VERSION);
    const markSeen = useSeenReleaseStore((state) => state.markSeen);

    usePageSeo(buildWhatsNewPageSeo(t));

    useEffect(() => {
        const latest = latestPublishedVersion(
            WHATS_NEW_ENTRIES,
            PLOTOPS_VERSION
        );
        if (latest) {
            markSeen(latest);
        }
    }, [markSeen]);

    const handleBack = () => {
        if (globalThis.history.length > 1) {
            router.history.back();
            return;
        }
        void router.navigate({ to: "/" });
    };

    return (
        <div className="mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-10 px-4 py-8 wrap-break-word sm:gap-14 sm:py-12 [view-transition-name:main-content]">
            <Button
                className="w-fit min-w-0 self-start"
                onClick={handleBack}
                size="sm"
                type="button"
                variant="ghost"
            >
                <ArrowLeft data-icon="inline-start" />
                {t("common:back")}
            </Button>

            <header className="flex min-w-0 flex-col gap-4 motion-reveal">
                <p className="font-mono text-meta text-primary uppercase tracking-[0.14em]">
                    {t("eyebrow")}
                </p>
                <h1 className="text-h1 text-foreground">{t("title")}</h1>
                <div aria-hidden className="h-px w-14 bg-primary/70" />
                <p className="max-w-xl text-body text-muted-foreground">
                    {t("intro")}
                </p>
                <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
                    <span className="font-mono text-meta text-foreground tabular-nums">
                        {t("currentVersion", {
                            version: `v${PLOTOPS_VERSION}`,
                        })}
                    </span>
                    <a
                        className="inline-flex items-center gap-1 text-meta text-muted-foreground underline underline-offset-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        href={`${PLOTOPS_GITHUB_URL}/blob/main/CHANGELOG.md`}
                        rel="noreferrer"
                        target="_blank"
                    >
                        {t("fullChangelog")}
                        <ExternalLink aria-hidden className="size-3" />
                    </a>
                </div>
            </header>

            <ol
                aria-label={t("timelineLabel")}
                className="relative flex min-w-0 flex-col border-l border-border"
            >
                {entries.map((entry) => (
                    <WhatsNewEntryItem
                        entry={entry}
                        key={entry.id}
                        locale={locale}
                    />
                ))}
            </ol>
        </div>
    );
}

function formatEntryDate(entry: WhatsNewEntry, locale: WhatsNewLocale) {
    const dateLocale = DATE_LOCALES[locale];
    const to = format(parseISO(entry.date), "d MMM yyyy", {
        locale: dateLocale,
    });

    if (!entry.from) {
        return to;
    }

    const from = format(parseISO(entry.from), "d MMM", { locale: dateLocale });
    return `${from} – ${to}`;
}

function WhatsNewEntryItem({
    entry,
    locale,
}: {
    entry: WhatsNewEntry;
    locale: WhatsNewLocale;
}) {
    const { t } = useTranslation("whatsNew");
    const isRelease = entry.version !== null;

    return (
        <li
            className="relative flex min-w-0 scroll-mt-24 flex-col gap-4 pb-12 pl-6 last:pb-0 sm:pl-8"
            id={entry.id}
        >
            <span
                aria-hidden
                className={cn(
                    "absolute top-1.5 -left-[5px] size-2.5 rotate-45 border",
                    isRelease
                        ? "border-primary bg-primary"
                        : "border-border bg-background"
                )}
            />
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
                <span
                    className={cn(
                        "font-mono text-meta uppercase tracking-[0.08em] tabular-nums",
                        isRelease ? "text-primary" : "text-muted-foreground"
                    )}
                >
                    {isRelease ? `v${entry.version}` : t("period")}
                </span>
                <time
                    className="font-mono text-meta text-muted-foreground tabular-nums"
                    dateTime={entry.date}
                >
                    {formatEntryDate(entry, locale)}
                </time>
            </div>
            <div className="flex min-w-0 flex-col gap-2">
                <h2 className="text-h2 text-foreground">
                    <a
                        className="hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        href={`#${entry.id}`}
                    >
                        {entry.title?.[locale] ??
                            t("releaseTitle", { version: entry.version })}
                    </a>
                </h2>
                {entry.summary ? (
                    <p className="max-w-2xl text-body text-muted-foreground">
                        {entry.summary[locale]}
                    </p>
                ) : null}
            </div>
            <ul className="flex min-w-0 flex-col gap-3 sm:gap-2.5">
                {entry.changes.map((change) => (
                    <li
                        className="flex min-w-0 flex-col items-start gap-1 sm:grid sm:grid-cols-[6.5rem_minmax(0,1fr)] sm:gap-3"
                        key={change.en}
                    >
                        <Badge
                            className={cn(
                                "mt-0.5 h-5 font-mono text-[0.625rem] uppercase tracking-[0.06em] sm:w-full sm:justify-start",
                                KIND_CLASS_NAMES[change.kind]
                            )}
                            variant="outline"
                        >
                            {t(`kind.${change.kind}`)}
                        </Badge>
                        <span className="min-w-0 text-sm leading-relaxed text-foreground/85">
                            {change[locale]}
                        </span>
                    </li>
                ))}
            </ul>
        </li>
    );
}
