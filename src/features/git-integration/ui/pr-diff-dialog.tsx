import { DiffFile } from "@git-diff-view/core";
import { DiffModeEnum, DiffView } from "@git-diff-view/react";
import "@git-diff-view/react/styles/diff-view-pure.css";
import {
    Columns2,
    FileCode,
    Maximize2,
    Minimize2,
    Minus,
    Plus,
    Rows2,
    X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type { GitPrFile } from "@/features/git-integration/api/github-git-api";

import { langFromFilename } from "@/features/git-integration/lib/file-lang";
import { resolveMissingPrPatchReason } from "@/features/git-integration/lib/resolve-missing-pr-patch-reason";
import { wrapGithubPatch } from "@/features/git-integration/lib/wrap-github-patch";
import { usePullRequestFiles } from "@/features/git-integration/model/use-git-data";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/shadcn/ui/badge";
import { Button } from "@/shared/shadcn/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/shared/shadcn/ui/dialog";
import { ScrollArea } from "@/shared/shadcn/ui/scroll-area";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/shadcn/ui/select";
import { Spinner } from "@/shared/shadcn/ui/spinner";

type DiffTheme = "dark" | "light";

type PrDiffDialogProperties = {
    onClose: () => void;
    open: boolean;
    prNumber: number;
    prTitle: string;
    repoFullName: string;
    /** Null for guest demos (fixtures load when session is guest). */
    token: null | string;
};

function useDocumentTheme(): DiffTheme {
    const [theme, setTheme] = useState<DiffTheme>(() =>
        globalThis.document?.documentElement.classList.contains("dark")
            ? "dark"
            : "light"
    );

    useEffect(() => {
        const root = document.documentElement;
        const sync = () => {
            setTheme(root.classList.contains("dark") ? "dark" : "light");
        };
        sync();
        const observer = new MutationObserver(sync);
        observer.observe(root, {
            attributeFilter: ["class"],
            attributes: true,
        });
        return () => observer.disconnect();
    }, []);

    return theme;
}

const STATUS_CLASS: Record<string, string> = {
    added: "text-emerald-500",
    modified: "text-sky-400",
    removed: "text-red-500",
    renamed: "text-amber-400",
};

const MOBILE_MAX_WIDTH_QUERY = "(max-width: 639px)";

export function PrDiffDialog({
    onClose,
    open,
    prNumber,
    prTitle,
    repoFullName,
    token,
}: PrDiffDialogProperties) {
    const { t } = useTranslation("board");
    const theme = useDocumentTheme();
    const preferUnifiedOnMobile = usePreferUnifiedDiffOnMobile();
    const [activeFilename, setActiveFilename] = useState<string | undefined>();
    const [mode, setMode] = useState<DiffModeEnum>(DiffModeEnum.Split);
    const [fullscreen, setFullscreen] = useState(false);

    const { data, isError, isLoading, refetch } = usePullRequestFiles(
        repoFullName,
        prNumber,
        token
    );
    const files = data?.files ?? [];
    const truncated = data?.truncated ?? false;

    useEffect(() => {
        setActiveFilename(undefined);
        setFullscreen(false);
        setMode(
            preferUnifiedOnMobile ? DiffModeEnum.Unified : DiffModeEnum.Split
        );
    }, [prNumber, preferUnifiedOnMobile, repoFullName]);

    useEffect(() => {
        if (!open) setFullscreen(false);
    }, [open]);

    useEffect(() => {
        if (!fullscreen) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.stopPropagation();
                setFullscreen(false);
            }
            if (
                (event.key === "f" || event.key === "F") &&
                !event.metaKey &&
                !event.ctrlKey &&
                !event.altKey
            ) {
                const target = event.target as HTMLElement | null;
                const tag = target?.tagName;
                if (
                    tag === "INPUT" ||
                    tag === "TEXTAREA" ||
                    target?.isContentEditable
                ) {
                    return;
                }
                event.preventDefault();
                setFullscreen(false);
            }
        };

        globalThis.addEventListener("keydown", onKeyDown, true);
        return () => globalThis.removeEventListener("keydown", onKeyDown, true);
    }, [fullscreen]);

    const displayFile =
        files.find((file) => file.filename === activeFilename) ?? files[0];

    const totals = useMemo(() => {
        let additions = 0;
        let deletions = 0;
        for (const file of files) {
            additions += file.additions;
            deletions += file.deletions;
        }
        return { additions, deletions };
    }, [files]);

    return (
        <Dialog
            onOpenChange={(next) => {
                if (!next) onClose();
            }}
            open={open}
        >
            <DialogContent
                className={cn(
                    "flex max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none",
                    "max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none",
                    fullscreen
                        ? "inset-0 top-0 left-0 h-dvh w-screen max-h-none translate-x-0 translate-y-0 rounded-none"
                        : "h-[85vh] w-[min(96vw,72rem)]"
                )}
                showCloseButton={false}
            >
                <DialogHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0 border-b border-border px-4 py-3 text-left">
                    <DialogTitle className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                        <span className="shrink-0 font-mono text-muted-foreground">
                            #{prNumber}
                        </span>
                        <span className="truncate">{prTitle}</span>
                        <Badge className="shrink-0" variant="outline">
                            {t("git.diff")}
                        </Badge>
                        {!isLoading && files.length > 0 ? (
                            <span className="hidden shrink-0 items-center gap-2 text-meta sm:inline-flex">
                                <span className="text-emerald-500">
                                    +{totals.additions}
                                </span>
                                <span className="text-red-500">
                                    −{totals.deletions}
                                </span>
                            </span>
                        ) : undefined}
                    </DialogTitle>
                    <div className="flex shrink-0 items-center gap-1">
                        <Button
                            aria-label={t("git.splitView")}
                            aria-pressed={mode === DiffModeEnum.Split}
                            className="max-sm:hidden"
                            onClick={() => setMode(DiffModeEnum.Split)}
                            size="icon-sm"
                            type="button"
                            variant={
                                mode === DiffModeEnum.Split
                                    ? "secondary"
                                    : "ghost"
                            }
                        >
                            <Columns2 className="size-4" />
                        </Button>
                        <Button
                            aria-label={t("git.unifiedView")}
                            aria-pressed={mode === DiffModeEnum.Unified}
                            onClick={() => setMode(DiffModeEnum.Unified)}
                            size="icon-sm"
                            type="button"
                            variant={
                                mode === DiffModeEnum.Unified
                                    ? "secondary"
                                    : "ghost"
                            }
                        >
                            <Rows2 className="size-4" />
                        </Button>
                        <Button
                            aria-label={
                                fullscreen
                                    ? t("git.exitFullscreen")
                                    : t("git.enterFullscreen")
                            }
                            aria-pressed={fullscreen}
                            onClick={() => setFullscreen((value) => !value)}
                            size="icon-sm"
                            type="button"
                            variant={fullscreen ? "secondary" : "ghost"}
                        >
                            {fullscreen ? (
                                <Minimize2 className="size-4" />
                            ) : (
                                <Maximize2 className="size-4" />
                            )}
                        </Button>
                        <Button
                            aria-label={t("git.closeDiff")}
                            onClick={onClose}
                            size="icon-sm"
                            type="button"
                            variant="ghost"
                        >
                            <X className="size-4" />
                        </Button>
                    </div>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex flex-1 flex-col items-center justify-center gap-2">
                        <Spinner className="size-6 text-primary" />
                        <p className="text-ui text-muted-foreground">
                            {t("git.loadingDiff")}
                        </p>
                    </div>
                ) : isError ? (
                    <div className="flex flex-1 flex-col items-center justify-center gap-3">
                        <p className="text-ui text-muted-foreground">
                            {t("git.diffLoadFailed")}
                        </p>
                        <Button
                            onClick={() => {
                                void refetch();
                            }}
                            size="sm"
                            type="button"
                            variant="outline"
                        >
                            {t("git.retry")}
                        </Button>
                    </div>
                ) : files.length === 0 ? (
                    <div className="flex flex-1 items-center justify-center text-ui text-muted-foreground">
                        {t("git.noFiles")}
                    </div>
                ) : (
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
                        <div className="shrink-0 border-b border-border px-3 py-2 md:hidden">
                            <Select
                                onValueChange={(value) => {
                                    if (value) setActiveFilename(value);
                                }}
                                value={displayFile?.filename}
                            >
                                <SelectTrigger
                                    aria-label={t("git.filesChanged", {
                                        count: files.length,
                                    })}
                                    className="w-full"
                                >
                                    <SelectValue
                                        placeholder={t("git.selectFile")}
                                    />
                                </SelectTrigger>
                                <SelectContent>
                                    {files.map((file) => (
                                        <SelectItem
                                            key={file.filename}
                                            value={file.filename}
                                        >
                                            {file.filename}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {truncated ? (
                                <p className="mt-2 text-meta text-amber-500">
                                    {t("git.filesTruncated", {
                                        count: files.length,
                                    })}
                                </p>
                            ) : null}
                        </div>

                        <aside className="hidden min-h-0 w-56 shrink-0 flex-col overflow-hidden border-r border-border md:flex md:w-64">
                            <p className="shrink-0 px-3 py-2 text-meta text-muted-foreground">
                                {t("git.filesChanged", {
                                    count: files.length,
                                })}
                            </p>
                            {truncated ? (
                                <p className="shrink-0 px-3 pb-2 text-meta text-amber-500">
                                    {t("git.filesTruncated", {
                                        count: files.length,
                                    })}
                                </p>
                            ) : null}
                            <ScrollArea className="min-h-0 flex-1">
                                <div className="flex flex-col gap-0.5 px-2 pb-2">
                                    {files.map((file) => (
                                        <FileEntry
                                            file={file}
                                            isActive={
                                                displayFile?.filename ===
                                                file.filename
                                            }
                                            key={file.filename}
                                            onClick={() =>
                                                setActiveFilename(file.filename)
                                            }
                                        />
                                    ))}
                                </div>
                            </ScrollArea>
                        </aside>

                        <div className="min-w-0 flex-1 overflow-auto bg-background">
                            {displayFile ? (
                                <div className="sticky top-0 z-10 border-b border-border bg-muted/40 px-3 py-2">
                                    <p className="truncate font-mono text-code text-muted-foreground">
                                        {displayFile.previous_filename &&
                                        displayFile.previous_filename !==
                                            displayFile.filename
                                            ? `${displayFile.previous_filename} → ${displayFile.filename}`
                                            : displayFile.filename}
                                    </p>
                                </div>
                            ) : undefined}
                            {displayFile ? (
                                <FileDiffPanel
                                    file={displayFile}
                                    mode={mode}
                                    theme={theme}
                                />
                            ) : (
                                <div className="flex h-full items-center justify-center text-muted-foreground text-ui">
                                    {t("git.selectFile")}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

function FileDiffPanel({
    file,
    mode,
    theme,
}: {
    file: GitPrFile;
    mode: DiffModeEnum;
    theme: DiffTheme;
}) {
    const { t } = useTranslation("board");

    const diffFile = useMemo(() => {
        const hunk = wrapGithubPatch(file);
        if (!hunk) return;

        const lang = langFromFilename(file.filename);
        const oldName =
            file.status === "added"
                ? "/dev/null"
                : (file.previous_filename ?? file.filename);
        const newName = file.status === "removed" ? "/dev/null" : file.filename;

        const instance = new DiffFile(
            oldName,
            "",
            newName,
            "",
            [hunk],
            lang,
            lang
        );
        instance.initTheme(theme);
        instance.init();
        instance.buildSplitDiffLines();
        instance.buildUnifiedDiffLines();
        return instance;
    }, [file, theme]);

    if (!file.patch) {
        const reason = resolveMissingPrPatchReason(file.filename);
        return (
            <div className="flex h-full min-h-48 flex-col items-center justify-center gap-3 px-4 text-center text-muted-foreground text-ui">
                <p>
                    {reason === "binary"
                        ? t("git.binaryFile")
                        : t("git.diffTooLarge")}
                </p>
                {file.blob_url ? (
                    <a
                        className="text-foreground underline-offset-4 hover:underline focus-visible:ring-2"
                        href={file.blob_url}
                        rel="noreferrer"
                        target="_blank"
                    >
                        {t("git.openOnGitHub")}
                    </a>
                ) : null}
            </div>
        );
    }

    if (!diffFile || diffFile.splitLineLength === 0) {
        return (
            <pre className="overflow-auto p-4 font-mono text-code text-foreground whitespace-pre-wrap">
                {file.patch}
            </pre>
        );
    }

    return (
        <div className="min-h-0 w-full">
            <DiffView
                diffFile={diffFile}
                diffViewFontSize={12}
                diffViewHighlight
                diffViewMode={mode}
                diffViewTheme={theme}
                diffViewWrap
            />
        </div>
    );
}

function FileEntry({
    file,
    isActive,
    onClick,
}: {
    file: GitPrFile;
    isActive: boolean;
    onClick: () => void;
}) {
    const short = file.filename.split("/").pop() ?? file.filename;
    return (
        <button
            className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-ui transition-colors hover:bg-muted",
                isActive && "bg-muted"
            )}
            onClick={onClick}
            title={file.filename}
            type="button"
        >
            <FileCode
                aria-hidden
                className={cn(
                    "size-3.5 shrink-0",
                    STATUS_CLASS[file.status] ?? "text-muted-foreground"
                )}
            />
            <span className="min-w-0 flex-1 truncate font-mono text-xs">
                {short}
            </span>
            <span className="flex shrink-0 items-center gap-1 text-meta">
                <Plus aria-hidden className="size-3 text-emerald-500" />
                <span className="text-emerald-500">{file.additions}</span>
                <Minus aria-hidden className="size-3 text-red-500" />
                <span className="text-red-500">{file.deletions}</span>
            </span>
        </button>
    );
}

function usePreferUnifiedDiffOnMobile() {
    const [preferUnified, setPreferUnified] = useState(() =>
        typeof globalThis.matchMedia === "function"
            ? globalThis.matchMedia(MOBILE_MAX_WIDTH_QUERY).matches
            : false
    );

    useEffect(() => {
        const media = globalThis.matchMedia(MOBILE_MAX_WIDTH_QUERY);
        const sync = () => setPreferUnified(media.matches);
        sync();
        media.addEventListener("change", sync);
        return () => media.removeEventListener("change", sync);
    }, []);

    return preferUnified;
}
