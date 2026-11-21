import {
    ArrowDown,
    ChevronRight,
    ChevronsDownUp,
    ChevronsUpDown,
    CircleAlert,
    WrapText,
} from "lucide-react";
import {
    memo,
    type ReactNode,
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useTranslation } from "react-i18next";

import type {
    AnsiTone,
    LogGroup,
    LogLevel,
    LogSegment,
    ParsedLogLine,
} from "@/features/ci-cd/model/parse-job-log";
import type { BuildLogLine, BuildStatus } from "@/features/ci-cd/model/types";

import { parseJobLog } from "@/features/ci-cd/model/parse-job-log";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/shadcn/ui/button";
import { Spinner } from "@/shared/shadcn/ui/spinner";

/** An error line to jump to, and the group to unfold for it. */
type ErrorTarget = { groupId: number | undefined; index: number };

type JobLogConsoleProperties = {
    /** Copy / download / resize controls, rendered at the toolbar's end. */
    actions?: ReactNode;
    isLive: boolean;
    isLoading: boolean;
    jobName: string | undefined;
    lines: BuildLogLine[];
    /** Job status — tints the loading scan. */
    status: BuildStatus | undefined;
};

/** Distance from the bottom (px) that still counts as "following" the log. */
const FOLLOW_SLACK_PX = 24;
const ROW = "grid grid-cols-[3.75rem_minmax(0,1fr)]";
const GUTTER =
    "select-none border-r border-border/40 px-2 py-px text-right text-muted-foreground/45 tabular-nums";
const SKELETON_WIDTHS = ["62%", "38%", "81%", "54%", "70%", "29%", "66%"];

const LEVEL_ROW: Record<LogLevel, string> = {
    command: "text-sky-300",
    debug: "text-muted-foreground/70",
    error: "bg-red-500/10 text-red-200 shadow-[inset_2px_0_0_var(--color-red-500)]",
    notice: "bg-sky-500/10 text-sky-200 shadow-[inset_2px_0_0_var(--color-sky-400)]",
    plain: "",
    section: "font-semibold text-foreground",
    warning:
        "bg-amber-500/10 text-amber-100 shadow-[inset_2px_0_0_var(--color-amber-400)]",
};

const LEVEL_LABEL: Partial<Record<LogLevel, string>> = {
    error: "text-red-400",
    notice: "text-sky-300",
    warning: "text-amber-300",
};

const TONE: Record<AnsiTone, string> = {
    blue: "text-sky-400",
    cyan: "text-cyan-300",
    gray: "text-muted-foreground",
    green: "text-emerald-400",
    magenta: "text-fuchsia-400",
    red: "text-red-400",
    white: "text-foreground",
    yellow: "text-amber-300",
};

const SCAN_TONE: Record<BuildStatus, string> = {
    failure: "cicd-live-scan-danger",
    queued: "",
    running: "",
    success: "cicd-live-scan-success",
};

/**
 * The console of one job's log: GitHub step groups fold like on GitHub,
 * `##[error]`/`##[warning]` lines stand out, ANSI colours are kept.
 * Follows the end of the log until the reader scrolls up.
 * Mount it with `key={job.id}` so fold state resets per job.
 */
export function JobLogConsole({
    actions,
    isLive,
    isLoading,
    jobName,
    lines,
    status,
}: JobLogConsoleProperties) {
    const { t } = useTranslation("board");
    const scrollerReference = useRef<HTMLDivElement>(null);
    const followReference = useRef(true);
    const [atEnd, setAtEnd] = useState(true);
    const [wrap, setWrap] = useState(true);
    const [folds, setFolds] = useState<ReadonlyMap<number, boolean>>(
        () => new Map()
    );
    const [errorCursor, setErrorCursor] = useState(-1);
    const [focusLine, setFocusLine] = useState<number>();

    const entries = useMemo(() => parseJobLog(lines), [lines]);
    const groups = useMemo(
        () =>
            entries.flatMap((entry) =>
                entry.kind === "group" ? [entry.group] : []
            ),
        [entries]
    );
    const errors = useMemo(
        () =>
            entries.flatMap((entry): ErrorTarget[] =>
                entry.kind === "group"
                    ? entry.group.lines
                          .filter((line) => line.level === "error")
                          .map((line) => ({
                              groupId: entry.group.id,
                              index: line.index,
                          }))
                    : entry.line.level === "error"
                      ? [{ groupId: undefined, index: entry.line.index }]
                      : []
            ),
        [entries]
    );

    const isExpanded = (group: LogGroup) =>
        folds.get(group.id) ?? (group.errorCount > 0 || !group.closed);
    const allExpanded =
        groups.length > 0 && groups.every((group) => isExpanded(group));

    const toggleGroup = useCallback((id: number, expanded: boolean) => {
        setFolds((previous) => new Map(previous).set(id, !expanded));
    }, []);

    const toggleAll = () => {
        setFolds(new Map(groups.map((group) => [group.id, !allExpanded])));
    };

    const jumpToNextError = () => {
        if (errors.length === 0) return;
        const next = (errorCursor + 1) % errors.length;
        const target = errors[next];
        if (!target) return;
        const { groupId } = target;
        if (groupId !== undefined) {
            setFolds((previous) => new Map(previous).set(groupId, true));
        }
        setErrorCursor(next);
        setFocusLine(target.index);
    };

    const jumpToEnd = () => {
        const scroller = scrollerReference.current;
        if (!scroller) return;
        followReference.current = true;
        setAtEnd(true);
        scroller.scrollTo({ behavior: "smooth", top: scroller.scrollHeight });
    };

    const handleScroll = () => {
        const scroller = scrollerReference.current;
        if (!scroller) return;
        const nearEnd =
            scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight <
            FOLLOW_SLACK_PX;
        followReference.current = nearEnd;
        setAtEnd(nearEnd);
    };

    // Follow new output while the reader is at the end.
    useLayoutEffect(() => {
        const scroller = scrollerReference.current;
        if (!scroller || !followReference.current) return;
        scroller.scrollTop = scroller.scrollHeight;
    }, [entries]);

    // Bring a jumped-to error into view once its group has unfolded.
    useEffect(() => {
        if (focusLine === undefined) return;
        scrollerReference.current
            ?.querySelector(`[data-line="${focusLine}"]`)
            ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, [focusLine, folds]);

    const showLoader = isLoading && lines.length === 0;
    const scanning = isLoading || isLive;

    return (
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden border border-border bg-background">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-1.5">
                <span className="flex min-w-0 items-baseline gap-2 font-mono text-meta text-muted-foreground uppercase tracking-[0.12em]">
                    <span className="shrink-0">{t("cicd.logs.console")}</span>
                    {jobName ? (
                        <span className="min-w-0 truncate normal-case tracking-normal text-foreground">
                            {jobName}
                        </span>
                    ) : undefined}
                </span>
                <div className="flex shrink-0 items-center gap-3">
                    {lines.length > 0 ? (
                        <span className="hidden font-mono text-meta text-muted-foreground/60 tabular-nums sm:inline">
                            {String(lines.length).padStart(3, "0")}{" "}
                            {t("cicd.logs.lines")}
                        </span>
                    ) : undefined}
                    {isLive ? (
                        <span className="inline-flex items-center gap-1.5 font-mono text-meta text-amber-300 uppercase tracking-[0.12em]">
                            <span className="size-1.5 bg-amber-400 cicd-status-breathe" />
                            {t("cicd.logs.live")}
                        </span>
                    ) : undefined}
                    {errors.length > 0 ? (
                        <Button
                            className="gap-1 font-mono text-meta text-red-400 tabular-nums hover:text-red-300"
                            onClick={jumpToNextError}
                            size="xs"
                            title={t("cicd.logs.nextError")}
                            type="button"
                            variant="ghost"
                        >
                            <CircleAlert data-icon="inline-start" />
                            {t("cicd.logs.errors", { count: errors.length })}
                        </Button>
                    ) : undefined}
                    <div className="flex items-center gap-0.5">
                        {groups.length > 0 ? (
                            <Button
                                aria-label={t(
                                    allExpanded
                                        ? "cicd.logs.collapseAll"
                                        : "cicd.logs.expandAll"
                                )}
                                onClick={toggleAll}
                                size="icon-xs"
                                title={t(
                                    allExpanded
                                        ? "cicd.logs.collapseAll"
                                        : "cicd.logs.expandAll"
                                )}
                                type="button"
                                variant="ghost"
                            >
                                {allExpanded ? (
                                    <ChevronsDownUp />
                                ) : (
                                    <ChevronsUpDown />
                                )}
                            </Button>
                        ) : undefined}
                        <Button
                            aria-label={t("cicd.logs.wrap")}
                            aria-pressed={wrap}
                            className={cn(wrap && "text-foreground")}
                            onClick={() => setWrap((value) => !value)}
                            size="icon-xs"
                            title={t("cicd.logs.wrap")}
                            type="button"
                            variant={wrap ? "secondary" : "ghost"}
                        >
                            <WrapText />
                        </Button>
                        {actions}
                    </div>
                </div>
            </div>

            <div
                aria-hidden
                className={cn(
                    "h-0.5 shrink-0",
                    scanning
                        ? cn(
                              "cicd-live-scan bg-border/40",
                              status && !isLive && SCAN_TONE[status]
                          )
                        : "bg-transparent"
                )}
            />

            <div
                className="scrollbar-board min-h-0 flex-1 overflow-auto"
                onScroll={handleScroll}
                ref={scrollerReference}
            >
                {showLoader ? (
                    <LogLoading
                        label={t(
                            isLive
                                ? "cicd.logs.loadingLive"
                                : "cicd.logs.loadingFull"
                        )}
                    />
                ) : (
                    <div
                        aria-busy={isLoading}
                        aria-live={isLive ? "polite" : "off"}
                        className={cn(
                            "min-h-full font-mono text-meta normal-case tracking-normal text-foreground sm:text-code",
                            "selection:bg-primary/30",
                            !wrap && "w-max min-w-full"
                        )}
                        role="log"
                    >
                        {entries.map((entry) =>
                            entry.kind === "group" ? (
                                <LogGroupBlock
                                    expanded={isExpanded(entry.group)}
                                    focusLine={focusLine}
                                    group={entry.group}
                                    isLive={isLive}
                                    key={`g${entry.group.id}`}
                                    onToggle={toggleGroup}
                                    wrap={wrap}
                                />
                            ) : (
                                <LogRow
                                    focused={entry.line.index === focusLine}
                                    key={entry.line.index}
                                    line={entry.line}
                                    wrap={wrap}
                                />
                            )
                        )}
                        {isLive ? (
                            <div aria-hidden className={ROW}>
                                <span className="border-r border-border/40" />
                                <span className="inline-block px-2.5 text-emerald-400 motion-safe:animate-pulse">
                                    ▌
                                </span>
                            </div>
                        ) : undefined}
                        {!isLoading && lines.length === 0 ? (
                            <p className="px-3 py-3 text-muted-foreground">
                                {t("cicd.logs.empty")}
                            </p>
                        ) : undefined}
                    </div>
                )}
            </div>

            {atEnd || lines.length === 0 ? undefined : (
                <Button
                    className="absolute right-4 bottom-3 shadow-md"
                    onClick={jumpToEnd}
                    size="xs"
                    type="button"
                    variant="secondary"
                >
                    <ArrowDown data-icon="inline-start" />
                    {t("cicd.logs.jumpToEnd")}
                </Button>
            )}
        </div>
    );
}

const LogGroupBlock = memo(function LogGroupBlock({
    expanded,
    focusLine,
    group,
    isLive,
    onToggle,
    wrap,
}: {
    expanded: boolean;
    focusLine: number | undefined;
    group: LogGroup;
    isLive: boolean;
    onToggle: (id: number, expanded: boolean) => void;
    wrap: boolean;
}) {
    const { t } = useTranslation("board");
    const failed = group.errorCount > 0;

    return (
        <div className={cn(expanded && "border-b border-border/40")}>
            <button
                aria-expanded={expanded}
                className={cn(
                    ROW,
                    "w-full border-b border-border/30 text-left transition-colors",
                    "hover:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                    expanded && "bg-muted/30",
                    failed && "text-red-300"
                )}
                data-line={group.title.index}
                onClick={() => onToggle(group.id, expanded)}
                type="button"
            >
                <span aria-hidden className={GUTTER}>
                    {group.title.index + 1}
                </span>
                <span className="flex min-w-0 items-center gap-1.5 px-1.5 py-0.5">
                    <ChevronRight
                        aria-hidden
                        className={cn(
                            "size-3.5 shrink-0 text-muted-foreground transition-transform duration-150",
                            expanded && "rotate-90"
                        )}
                    />
                    <span className="min-w-0 truncate font-medium">
                        <Segments segments={group.title.segments} />
                    </span>
                    {!group.closed && isLive ? (
                        <Spinner className="size-3 shrink-0 text-amber-400" />
                    ) : undefined}
                    <span className="ml-auto flex shrink-0 items-center gap-2 pr-1 text-muted-foreground/50 tabular-nums">
                        {failed ? (
                            <span className="inline-flex items-center gap-1 text-red-400">
                                <CircleAlert aria-hidden className="size-3" />
                                {t("cicd.logs.errors", {
                                    count: group.errorCount,
                                })}
                            </span>
                        ) : undefined}
                        <span>{group.lines.length}</span>
                    </span>
                </span>
            </button>
            {expanded
                ? group.lines.map((line) => (
                      <LogRow
                          focused={line.index === focusLine}
                          key={line.index}
                          line={line}
                          nested
                          wrap={wrap}
                      />
                  ))
                : undefined}
        </div>
    );
});

const LogRow = memo(function LogRow({
    focused,
    line,
    nested = false,
    wrap,
}: {
    focused: boolean;
    line: ParsedLogLine;
    nested?: boolean;
    wrap: boolean;
}) {
    const { t } = useTranslation("board");
    const label = LEVEL_LABEL[line.level];

    return (
        <div
            className={cn(
                ROW,
                // Off-screen rows skip layout — job logs run to thousands of lines.
                "[contain-intrinsic-size:auto_1.25rem] [content-visibility:auto]",
                LEVEL_ROW[line.level],
                focused && "outline-2 -outline-offset-2 outline-red-400"
            )}
            data-line={line.index}
        >
            <span aria-hidden className={GUTTER}>
                {line.index + 1}
            </span>
            <span
                className={cn(
                    "px-2.5 py-px",
                    nested && "pl-7",
                    wrap ? "whitespace-pre-wrap break-all" : "whitespace-pre"
                )}
            >
                {label ? (
                    <span
                        className={cn(
                            "mr-2 font-semibold uppercase tracking-[0.08em]",
                            label
                        )}
                    >
                        {t(`cicd.logs.level.${line.level}`)}
                    </span>
                ) : undefined}
                <Segments segments={line.segments} />
            </span>
        </div>
    );
});

function LogLoading({ label }: { label: string }) {
    return (
        <div className="flex flex-col gap-5 px-4 py-5" role="status">
            <span className="inline-flex items-center gap-2 font-mono text-meta text-muted-foreground uppercase tracking-[0.12em]">
                <Spinner className="size-3.5 text-primary" />
                {label}
            </span>
            <div aria-hidden className="flex flex-col gap-2.5">
                {SKELETON_WIDTHS.map((width, index) => (
                    <div className="flex items-center gap-3" key={width}>
                        <span className="h-2.5 w-6 shrink-0 bg-muted/50" />
                        <span
                            className="h-2.5 bg-muted motion-safe:animate-pulse"
                            style={{
                                animationDelay: `${index * 120}ms`,
                                width,
                            }}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}

function Segments({ segments }: { segments: LogSegment[] }) {
    return segments.map((segment, index) =>
        segment.tone || segment.bold || segment.dim ? (
            <span
                className={cn(
                    segment.tone && TONE[segment.tone],
                    segment.bold && "font-semibold",
                    segment.dim && "opacity-60"
                )}
                // Runs of one line never reorder.
                key={index}
            >
                {segment.text}
            </span>
        ) : (
            segment.text
        )
    );
}
