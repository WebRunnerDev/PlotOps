import { DiffFile } from "@git-diff-view/core";
import { DiffModeEnum, DiffView } from "@git-diff-view/react";
import "@git-diff-view/react/styles/diff-view-pure.css";
import {
    ChevronDown,
    Columns2,
    FileCode,
    GitCommitHorizontal,
    Maximize2,
    Minimize2,
    Minus,
    Plus,
    Rows2,
    X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type {
    GitCommit,
    GitPrFile,
} from "@/features/git-integration/api/github-git-api";

import { langFromFilename } from "@/features/git-integration/lib/file-lang";
import { resolveMissingPrPatchReason } from "@/features/git-integration/lib/resolve-missing-pr-patch-reason";
import { wrapGithubPatch } from "@/features/git-integration/lib/wrap-github-patch";
import {
    useCommitFiles,
    usePullRequestCommits,
    usePullRequestFiles,
} from "@/features/git-integration/model/use-git-data";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/shadcn/ui/badge";
import { Button } from "@/shared/shadcn/ui/button";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/shared/shadcn/ui/collapsible";
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

type FileSelection = {
    filename: string;
    /** Present when the file is shown from a specific commit patch. */
    sha?: string;
};

type PrDiffDialogProperties = {
    onClose: () => void;
    open: boolean;
    prNumber: number;
    prTitle: string;
    repoFullName: string;
    /** Null for guest demos (fixtures load when session is guest). */
    token: null | string;
};

type SidebarMode = "commits" | "files";

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
    const [sidebarMode, setSidebarMode] = useState<SidebarMode>("files");
    const [selection, setSelection] = useState<FileSelection | undefined>();
    const [expandedSha, setExpandedSha] = useState<string | undefined>();
    const [mode, setMode] = useState<DiffModeEnum>(DiffModeEnum.Split);
    const [fullscreen, setFullscreen] = useState(false);

    const {
        data: filesData,
        isError: filesError,
        isLoading: filesLoading,
        refetch: refetchFiles,
    } = usePullRequestFiles(repoFullName, prNumber, token);
    const files = filesData?.files ?? [];
    const filesTruncated = filesData?.truncated ?? false;

    const {
        data: commitsData,
        isError: commitsError,
        isLoading: commitsLoading,
        refetch: refetchCommits,
    } = usePullRequestCommits(
        repoFullName,
        prNumber,
        token,
        open && sidebarMode === "commits"
    );
    const commits = commitsData?.commits ?? [];
    const commitsTruncated = commitsData?.truncated ?? false;

    const activeCommitSha =
        sidebarMode === "commits"
            ? (selection?.sha ?? expandedSha ?? commits[0]?.sha)
            : undefined;

    const {
        data: commitFilesData,
        isError: commitFilesError,
        isLoading: commitFilesLoading,
    } = useCommitFiles(
        repoFullName,
        activeCommitSha,
        token,
        open && sidebarMode === "commits" && Boolean(activeCommitSha)
    );
    const commitFiles = commitFilesData?.files ?? [];

    useEffect(() => {
        setSelection(undefined);
        setExpandedSha(undefined);
        setSidebarMode("files");
        setFullscreen(false);
        setMode(
            preferUnifiedOnMobile ? DiffModeEnum.Unified : DiffModeEnum.Split
        );
    }, [prNumber, preferUnifiedOnMobile, repoFullName]);

    useEffect(() => {
        if (!open) setFullscreen(false);
    }, [open]);

    useEffect(() => {
        if (sidebarMode !== "commits") return;
        if (expandedSha) return;
        if (commits[0]) setExpandedSha(commits[0].sha);
    }, [commits, expandedSha, sidebarMode]);

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

    const displayFile = useMemo(() => {
        if (sidebarMode === "commits") {
            if (selection?.sha && selection.filename) {
                return (
                    commitFiles.find(
                        (file) => file.filename === selection.filename
                    ) ?? commitFiles[0]
                );
            }
            return commitFiles[0];
        }
        if (selection?.filename) {
            return (
                files.find((file) => file.filename === selection.filename) ??
                files[0]
            );
        }
        return files[0];
    }, [commitFiles, files, selection, sidebarMode]);

    const activeCommit = useMemo(
        () => commits.find((commit) => commit.sha === activeCommitSha),
        [activeCommitSha, commits]
    );

    const totals = useMemo(() => {
        let additions = 0;
        let deletions = 0;
        for (const file of files) {
            additions += file.additions;
            deletions += file.deletions;
        }
        return { additions, deletions };
    }, [files]);

    const isLoading =
        filesLoading || (sidebarMode === "commits" && commitsLoading);
    const isError =
        filesError ||
        (sidebarMode === "commits" && commitsError && !filesError);

    const selectFile = (next: FileSelection) => {
        setSelection(next);
        if (next.sha) setExpandedSha(next.sha);
    };

    const switchSidebarMode = (next: SidebarMode) => {
        setSidebarMode(next);
        setSelection(undefined);
    };

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
                        {!filesLoading && files.length > 0 ? (
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
                                void refetchFiles();
                                if (sidebarMode === "commits") {
                                    void refetchCommits();
                                }
                            }}
                            size="sm"
                            type="button"
                            variant="outline"
                        >
                            {t("git.retry")}
                        </Button>
                    </div>
                ) : files.length === 0 && sidebarMode === "files" ? (
                    <div className="flex flex-1 items-center justify-center text-ui text-muted-foreground">
                        {t("git.noFiles")}
                    </div>
                ) : (
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
                        <div className="shrink-0 space-y-2 border-b border-border px-3 py-2 md:hidden">
                            <SidebarModeToggle
                                mode={sidebarMode}
                                onChange={switchSidebarMode}
                            />
                            {sidebarMode === "files" ? (
                                <>
                                    <Select
                                        onValueChange={(value) => {
                                            if (value)
                                                selectFile({ filename: value });
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
                                                placeholder={t(
                                                    "git.selectFile"
                                                )}
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
                                    {filesTruncated ? (
                                        <p className="text-meta text-amber-500">
                                            {t("git.filesTruncated", {
                                                count: files.length,
                                            })}
                                        </p>
                                    ) : null}
                                </>
                            ) : (
                                <MobileCommitFileSelect
                                    commits={commits}
                                    commitsTruncated={commitsTruncated}
                                    onSelect={selectFile}
                                    repoFullName={repoFullName}
                                    selection={
                                        selection ??
                                        (displayFile && activeCommitSha
                                            ? {
                                                  filename:
                                                      displayFile.filename,
                                                  sha: activeCommitSha,
                                              }
                                            : undefined)
                                    }
                                    token={token}
                                />
                            )}
                        </div>

                        <aside className="hidden min-h-0 w-56 shrink-0 flex-col overflow-hidden border-r border-border md:flex md:w-72">
                            <div className="shrink-0 space-y-2 border-b border-border px-2 py-2">
                                <SidebarModeToggle
                                    mode={sidebarMode}
                                    onChange={switchSidebarMode}
                                />
                                {sidebarMode === "files" ? (
                                    <p className="px-1 text-meta text-muted-foreground">
                                        {t("git.filesChanged", {
                                            count: files.length,
                                        })}
                                    </p>
                                ) : (
                                    <p className="px-1 text-meta text-muted-foreground">
                                        {t("git.commits")}
                                        {commits.length > 0
                                            ? ` · ${commits.length}`
                                            : ""}
                                    </p>
                                )}
                                {sidebarMode === "files" && filesTruncated ? (
                                    <p className="px-1 text-meta text-amber-500">
                                        {t("git.filesTruncated", {
                                            count: files.length,
                                        })}
                                    </p>
                                ) : null}
                                {sidebarMode === "commits" &&
                                commitsTruncated ? (
                                    <p className="px-1 text-meta text-amber-500">
                                        {t("git.commitsTruncated", {
                                            count: commits.length,
                                        })}
                                    </p>
                                ) : null}
                            </div>
                            <ScrollArea className="min-h-0 flex-1">
                                {sidebarMode === "files" ? (
                                    <div className="flex flex-col gap-0.5 px-2 py-2">
                                        {files.map((file) => (
                                            <FileEntry
                                                file={file}
                                                isActive={
                                                    displayFile?.filename ===
                                                    file.filename
                                                }
                                                key={file.filename}
                                                onClick={() =>
                                                    selectFile({
                                                        filename: file.filename,
                                                    })
                                                }
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-1 px-2 py-2">
                                        {commits.map((commit) => (
                                            <CommitGroup
                                                commit={commit}
                                                isExpanded={
                                                    expandedSha === commit.sha
                                                }
                                                key={commit.sha}
                                                onExpandChange={(openNext) => {
                                                    setExpandedSha(
                                                        openNext
                                                            ? commit.sha
                                                            : undefined
                                                    );
                                                }}
                                                onSelectFile={(file) =>
                                                    selectFile({
                                                        filename: file.filename,
                                                        sha: commit.sha,
                                                    })
                                                }
                                                repoFullName={repoFullName}
                                                selectedFilename={
                                                    selection?.sha ===
                                                    commit.sha
                                                        ? selection.filename
                                                        : displayFile &&
                                                            expandedSha ===
                                                                commit.sha
                                                          ? displayFile.filename
                                                          : undefined
                                                }
                                                token={token}
                                            />
                                        ))}
                                    </div>
                                )}
                            </ScrollArea>
                        </aside>

                        <div className="min-w-0 flex-1 overflow-auto bg-background">
                            {sidebarMode === "commits" &&
                            commitFilesLoading &&
                            !displayFile ? (
                                <div className="flex h-full flex-col items-center justify-center gap-2">
                                    <Spinner className="size-5 text-primary" />
                                    <p className="text-muted-foreground text-ui">
                                        {t("git.loadingCommitFiles")}
                                    </p>
                                </div>
                            ) : sidebarMode === "commits" &&
                              commitFilesError &&
                              !displayFile ? (
                                <div className="flex h-full items-center justify-center text-muted-foreground text-ui">
                                    {t("git.commitFilesFailed")}
                                </div>
                            ) : displayFile ? (
                                <>
                                    <div className="sticky top-0 z-10 border-b border-border bg-muted/40 px-3 py-2">
                                        <p className="truncate font-mono text-code text-muted-foreground">
                                            {displayFile.previous_filename &&
                                            displayFile.previous_filename !==
                                                displayFile.filename
                                                ? `${displayFile.previous_filename} → ${displayFile.filename}`
                                                : displayFile.filename}
                                        </p>
                                        {sidebarMode === "commits" &&
                                        activeCommit ? (
                                            <p className="mt-0.5 truncate font-mono text-meta text-muted-foreground">
                                                {activeCommit.sha.slice(0, 7)} ·{" "}
                                                {activeCommit.message}
                                            </p>
                                        ) : null}
                                    </div>
                                    <FileDiffPanel
                                        file={displayFile}
                                        mode={mode}
                                        theme={theme}
                                    />
                                </>
                            ) : (
                                <div className="flex h-full items-center justify-center text-muted-foreground text-ui">
                                    {sidebarMode === "commits"
                                        ? t("git.noCommitFiles")
                                        : t("git.selectFile")}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

function CommitGroup({
    commit,
    isExpanded,
    onExpandChange,
    onSelectFile,
    repoFullName,
    selectedFilename,
    token,
}: {
    commit: GitCommit;
    isExpanded: boolean;
    onExpandChange: (open: boolean) => void;
    onSelectFile: (file: GitPrFile) => void;
    repoFullName: string;
    selectedFilename: string | undefined;
    token: null | string;
}) {
    const { t } = useTranslation("board");
    const { data, isError, isLoading } = useCommitFiles(
        repoFullName,
        commit.sha,
        token,
        isExpanded
    );
    const files = data?.files ?? [];

    return (
        <Collapsible onOpenChange={onExpandChange} open={isExpanded}>
            <CollapsibleTrigger className="flex w-full items-start gap-1.5 rounded-md px-2 py-1.5 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
                <ChevronDown
                    aria-hidden
                    className={cn(
                        "mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform",
                        !isExpanded && "-rotate-90"
                    )}
                />
                <GitCommitHorizontal
                    aria-hidden
                    className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                />
                <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-xs text-muted-foreground">
                        {commit.sha.slice(0, 7)}
                    </span>
                    <span className="block truncate text-ui">
                        {commit.message}
                    </span>
                </span>
            </CollapsibleTrigger>
            <CollapsibleContent>
                <div className="mt-0.5 mb-1 ml-4 flex flex-col gap-0.5 border-l border-border pl-2">
                    {isLoading ? (
                        <p className="px-2 py-1 text-meta text-muted-foreground">
                            {t("git.loadingCommitFiles")}
                        </p>
                    ) : isError ? (
                        <p className="px-2 py-1 text-meta text-muted-foreground">
                            {t("git.commitFilesFailed")}
                        </p>
                    ) : files.length === 0 ? (
                        <p className="px-2 py-1 text-meta text-muted-foreground">
                            {t("git.noCommitFiles")}
                        </p>
                    ) : (
                        files.map((file) => (
                            <FileEntry
                                file={file}
                                isActive={selectedFilename === file.filename}
                                key={file.filename}
                                onClick={() => onSelectFile(file)}
                            />
                        ))
                    )}
                </div>
            </CollapsibleContent>
        </Collapsible>
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

function MobileCommitFileSelect({
    commits,
    commitsTruncated,
    onSelect,
    repoFullName,
    selection,
    token,
}: {
    commits: GitCommit[];
    commitsTruncated: boolean;
    onSelect: (selection: FileSelection) => void;
    repoFullName: string;
    selection: FileSelection | undefined;
    token: null | string;
}) {
    const { t } = useTranslation("board");
    const sha = selection?.sha ?? commits[0]?.sha;
    const { data, isLoading } = useCommitFiles(
        repoFullName,
        sha,
        token,
        Boolean(sha)
    );
    const files = data?.files ?? [];
    const fileValue =
        selection?.filename && selection.filename.length > 0
            ? selection.filename
            : files[0]?.filename;

    return (
        <div className="space-y-2">
            <Select
                onValueChange={(nextSha) => {
                    if (!nextSha) return;
                    onSelect({ filename: "", sha: nextSha });
                }}
                value={sha}
            >
                <SelectTrigger
                    aria-label={t("git.commits")}
                    className="w-full"
                    disabled={commits.length === 0}
                >
                    <SelectValue placeholder={t("git.commits")} />
                </SelectTrigger>
                <SelectContent>
                    {commits.map((commit) => (
                        <SelectItem key={commit.sha} value={commit.sha}>
                            {commit.sha.slice(0, 7)} · {commit.message}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Select
                onValueChange={(filename) => {
                    if (!filename || !sha) return;
                    onSelect({ filename, sha });
                }}
                value={fileValue}
            >
                <SelectTrigger
                    aria-label={t("git.selectFile")}
                    className="w-full"
                    disabled={isLoading || files.length === 0}
                >
                    <SelectValue placeholder={t("git.selectFile")} />
                </SelectTrigger>
                <SelectContent>
                    {files.map((file) => (
                        <SelectItem key={file.filename} value={file.filename}>
                            {file.filename}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {commitsTruncated ? (
                <p className="text-meta text-amber-500">
                    {t("git.commitsTruncated", { count: commits.length })}
                </p>
            ) : null}
        </div>
    );
}

function SidebarModeToggle({
    mode,
    onChange,
}: {
    mode: SidebarMode;
    onChange: (mode: SidebarMode) => void;
}) {
    const { t } = useTranslation("board");
    return (
        <div
            aria-label={t("git.diff")}
            className="grid grid-cols-2 gap-1 rounded-md border border-border p-0.5"
            role="group"
        >
            <Button
                aria-pressed={mode === "files"}
                className="h-7 px-2 text-xs"
                onClick={() => onChange("files")}
                size="sm"
                type="button"
                variant={mode === "files" ? "secondary" : "ghost"}
            >
                <FileCode className="size-3.5" />
                {t("git.viewByFiles")}
            </Button>
            <Button
                aria-pressed={mode === "commits"}
                className="h-7 px-2 text-xs"
                onClick={() => onChange("commits")}
                size="sm"
                type="button"
                variant={mode === "commits" ? "secondary" : "ghost"}
            >
                <GitCommitHorizontal className="size-3.5" />
                {t("git.viewByCommits")}
            </Button>
        </div>
    );
}

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
