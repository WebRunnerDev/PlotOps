import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ChevronDown, ExternalLink, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { BoardDefaultTaskType } from "@/features/boards/model/types";

import { resolveBoardsProvider } from "@/features/boards/api/resolve-boards-provider";
import { parseAllowedHeadPatterns } from "@/features/boards/lib/allowed-head-patterns";
import { BOARD_DEFAULT_TASK_TYPES } from "@/features/boards/model/constants";
import {
    useBoardMutations,
    useProjectBoards,
} from "@/features/boards/model/use-project-boards";
import { isGuest } from "@/features/guest-mode";
import { cn } from "@/shared/lib/utils";
import { Alert, AlertDescription } from "@/shared/shadcn/ui/alert";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/shared/shadcn/ui/alert-dialog";
import { Badge } from "@/shared/shadcn/ui/badge";
import { Button } from "@/shared/shadcn/ui/button";
import { Checkbox } from "@/shared/shadcn/ui/checkbox";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/shared/shadcn/ui/collapsible";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shared/shadcn/ui/dialog";
import { Input } from "@/shared/shadcn/ui/input";
import { Label } from "@/shared/shadcn/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
} from "@/shared/shadcn/ui/select";
import { Spinner } from "@/shared/shadcn/ui/spinner";
import { Textarea } from "@/shared/shadcn/ui/textarea";

type ProjectBoardsSettingsProperties = {
    defaultBaseBranch?: string;
    projectId: string;
    showAutoAssignToCreator?: boolean;
};

export function ProjectBoardsSettings({
    defaultBaseBranch = "main",
    projectId,
    showAutoAssignToCreator = false,
}: ProjectBoardsSettingsProperties) {
    const { t } = useTranslation("board");
    const navigate = useNavigate();
    const {
        data: boards = [],
        isError,
        isPending,
        refetch,
    } = useProjectBoards(projectId);
    const {
        createBoard,
        deleteBoard,
        isCreating,
        isDeleting,
        isUpdating,
        updateBoard,
    } = useBoardMutations(projectId);
    const [deleteId, setDeleteId] = useState<null | string>(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [newName, setNewName] = useState("");
    const [newBaseBranch, setNewBaseBranch] = useState(defaultBaseBranch);
    const [expandedId, setExpandedId] = useState<null | string>(null);

    const { data: hasTasks, isLoading: isCheckingTasks } = useQuery({
        enabled: Boolean(deleteId),
        queryFn: () =>
            resolveBoardsProvider(isGuest()).boardHasTasks(deleteId!),
        queryKey: ["board-has-tasks", deleteId],
    });

    const openBoard = (boardId: string) => {
        setDeleteId(null);
        void navigate({
            params: { boardId, projectId },
            to: "/projects/$projectId/boards/$boardId",
        });
    };

    const openCreate = () => {
        setNewName("");
        setNewBaseBranch(defaultBaseBranch);
        setCreateOpen(true);
    };

    const handleCreate = async () => {
        await createBoard(
            newName.trim() || t("boards.defaultNewName"),
            newBaseBranch.trim() || defaultBaseBranch || "main"
        );
        setCreateOpen(false);
        setNewName("");
        setNewBaseBranch(defaultBaseBranch);
        toast.success(t("boards.created"));
    };

    return (
        <section className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-h3">{t("boards.settingsTitle")}</h2>
                    <Button onClick={openCreate} size="sm" variant="outline">
                        <Plus data-icon="inline-start" />
                        {t("boards.addBoard")}
                    </Button>
                </div>
                <p className="text-ui text-muted-foreground">
                    {t("boards.settingsDescription")}
                </p>
            </div>

            {isPending ? (
                <div className="flex items-center gap-2 text-ui text-muted-foreground">
                    <Spinner className="size-4" />
                    {t("boards.loading")}
                </div>
            ) : isError ? (
                <div className="flex flex-col gap-3">
                    <Alert variant="destructive">
                        <AlertDescription>
                            {t("boardsLoadFailed")}
                        </AlertDescription>
                    </Alert>
                    <Button
                        onClick={() => void refetch()}
                        size="sm"
                        type="button"
                        variant="outline"
                    >
                        {t("git.retry")}
                    </Button>
                </div>
            ) : (
                <ul className="flex flex-col gap-2">
                    {boards.map((board) => (
                        <BoardSettingsCard
                            boardId={board.id}
                            canDelete={boards.length > 1}
                            expanded={expandedId === board.id}
                            initialAllowed={board.allowedHeadPatterns.join(
                                "\n"
                            )}
                            initialAutoAssignToCreator={
                                board.autoAssignToCreator
                            }
                            initialBase={board.baseBranch}
                            initialDefaultTaskType={board.defaultTaskType}
                            initialName={board.name}
                            isSaving={isUpdating}
                            key={board.id}
                            onDelete={() => setDeleteId(board.id)}
                            onExpandedChange={(open) =>
                                setExpandedId(open ? board.id : null)
                            }
                            onSave={async (patch) => {
                                await updateBoard(board.id, patch);
                                toast.success(t("boards.saved"));
                            }}
                            showAutoAssignToCreator={showAutoAssignToCreator}
                        />
                    ))}
                </ul>
            )}

            <Dialog onOpenChange={setCreateOpen} open={createOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t("boards.createTitle")}</DialogTitle>
                        <DialogDescription>
                            {t("boards.createDescription")}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="settings-board-name">
                                {t("boards.name")}
                            </Label>
                            <Input
                                id="settings-board-name"
                                onChange={(event) =>
                                    setNewName(event.target.value)
                                }
                                placeholder={t("boards.namePlaceholder")}
                                value={newName}
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="settings-board-base">
                                {t("boards.baseBranch")}
                            </Label>
                            <Input
                                className="font-mono text-sm"
                                id="settings-board-base"
                                onChange={(event) =>
                                    setNewBaseBranch(event.target.value)
                                }
                                placeholder="main"
                                value={newBaseBranch}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            onClick={() => setCreateOpen(false)}
                            variant="ghost"
                        >
                            {t("boards.cancel")}
                        </Button>
                        <Button
                            disabled={isCreating}
                            onClick={() => void handleCreate()}
                            type="button"
                        >
                            {isCreating ? (
                                <Spinner data-icon="inline-start" />
                            ) : undefined}
                            {t("boards.createConfirm")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog
                onOpenChange={(open) => {
                    if (!open) setDeleteId(null);
                }}
                open={Boolean(deleteId)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {hasTasks
                                ? t("boards.deleteBlockedTitle")
                                : t("boards.deleteTitle")}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {isCheckingTasks
                                ? t("boards.deleteChecking")
                                : hasTasks
                                  ? t("boards.deleteHasTasks")
                                  : t("boards.deleteDescription")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>
                            {t("boards.cancel")}
                        </AlertDialogCancel>
                        {isCheckingTasks ? (
                            <Button disabled size="sm">
                                <Spinner data-icon="inline-start" />
                                {t("boards.deleteChecking")}
                            </Button>
                        ) : hasTasks && deleteId ? (
                            <AlertDialogAction
                                onClick={() => openBoard(deleteId)}
                            >
                                <ExternalLink data-icon="inline-start" />
                                {t("boards.openBoard")}
                            </AlertDialogAction>
                        ) : (
                            <AlertDialogAction
                                disabled={isDeleting || !deleteId}
                                onClick={() => {
                                    if (!deleteId) return;
                                    const boardId = deleteId;
                                    void (async () => {
                                        try {
                                            await deleteBoard(boardId);
                                            toast.success(t("boards.deleted"));
                                        } catch (error) {
                                            const message =
                                                error instanceof Error
                                                    ? error.message
                                                    : t("boards.deleteFailed");
                                            toast.error(message);
                                        } finally {
                                            setDeleteId(null);
                                        }
                                    })();
                                }}
                            >
                                <Trash2 data-icon="inline-start" />
                                {t("boards.deleteConfirm")}
                            </AlertDialogAction>
                        )}
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </section>
    );
}

function BoardSettingsCard({
    boardId,
    canDelete,
    expanded,
    initialAllowed,
    initialAutoAssignToCreator,
    initialBase,
    initialDefaultTaskType,
    initialName,
    isSaving,
    onDelete,
    onExpandedChange,
    onSave,
    showAutoAssignToCreator,
}: {
    boardId: string;
    canDelete: boolean;
    expanded: boolean;
    initialAllowed: string;
    initialAutoAssignToCreator: boolean;
    initialBase: string;
    initialDefaultTaskType: BoardDefaultTaskType;
    initialName: string;
    isSaving: boolean;
    onDelete: () => void;
    onExpandedChange: (open: boolean) => void;
    onSave: (patch: {
        allowed_head_patterns?: string[];
        auto_assign_to_creator?: boolean;
        base_branch?: string;
        default_task_type?: BoardDefaultTaskType;
        name?: string;
    }) => Promise<void>;
    showAutoAssignToCreator: boolean;
}) {
    const { t } = useTranslation("board");
    const [name, setName] = useState(initialName);
    const [baseBranch, setBaseBranch] = useState(initialBase);
    const [defaultTaskType, setDefaultTaskType] = useState(
        initialDefaultTaskType
    );
    const [autoAssignToCreator, setAutoAssignToCreator] = useState(
        initialAutoAssignToCreator
    );
    const [allowedRaw, setAllowedRaw] = useState(initialAllowed);

    useEffect(() => {
        setName(initialName);
        setBaseBranch(initialBase);
        setDefaultTaskType(initialDefaultTaskType);
        setAutoAssignToCreator(initialAutoAssignToCreator);
        setAllowedRaw(initialAllowed);
    }, [
        initialAllowed,
        initialAutoAssignToCreator,
        initialBase,
        initialDefaultTaskType,
        initialName,
    ]);

    const dirty =
        name.trim() !== initialName ||
        baseBranch.trim() !== initialBase ||
        defaultTaskType !== initialDefaultTaskType ||
        (showAutoAssignToCreator &&
            autoAssignToCreator !== initialAutoAssignToCreator) ||
        parseAllowedHeadPatterns(allowedRaw).join("\n") !==
            parseAllowedHeadPatterns(initialAllowed).join("\n");

    const branchTone =
        baseBranch.trim() === "main" || baseBranch.trim() === "master"
            ? "border-transparent bg-emerald-500/20 text-emerald-400"
            : "border-transparent bg-sky-500/20 text-sky-400";

    return (
        <li>
            <Collapsible onOpenChange={onExpandedChange} open={expanded}>
                <div className="rounded-md border border-border bg-card">
                    <CollapsibleTrigger className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left outline-none hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring">
                        <ChevronDown
                            aria-hidden
                            className={cn(
                                "size-4 shrink-0 text-muted-foreground transition-transform",
                                expanded ? "" : "-rotate-90"
                            )}
                        />
                        <span className="min-w-0 flex-1 truncate text-ui font-medium">
                            {initialName || name || t("boards.defaultNewName")}
                        </span>
                        {dirty ? (
                            <Badge
                                className="shrink-0 rounded-sm font-mono text-[0.625rem]"
                                variant="outline"
                            >
                                {t("boards.unsaved")}
                            </Badge>
                        ) : undefined}
                        <Badge
                            className="shrink-0 rounded-sm px-1.5 font-mono text-[0.625rem]"
                            variant="outline"
                        >
                            {t(`taskType.${defaultTaskType}`)}
                        </Badge>
                        <Badge
                            className={cn(
                                "shrink-0 rounded-sm px-1.5 font-mono text-[0.625rem]",
                                branchTone
                            )}
                            variant="secondary"
                        >
                            {baseBranch.trim() || "—"}
                        </Badge>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                        <div className="flex flex-col gap-4 border-t border-border px-3.5 py-4">
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor={`board-name-${boardId}`}>
                                        {t("boards.name")}
                                    </Label>
                                    <Input
                                        id={`board-name-${boardId}`}
                                        onChange={(event) =>
                                            setName(event.target.value)
                                        }
                                        value={name}
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor={`board-base-${boardId}`}>
                                        {t("boards.baseBranch")}
                                    </Label>
                                    <Input
                                        className="font-mono text-sm"
                                        id={`board-base-${boardId}`}
                                        onChange={(event) =>
                                            setBaseBranch(event.target.value)
                                        }
                                        value={baseBranch}
                                    />
                                    <p className="text-meta text-muted-foreground">
                                        {t("boards.baseBranchHint")}
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-col gap-1.5 sm:max-w-xs">
                                <Label
                                    htmlFor={`board-default-type-${boardId}`}
                                >
                                    {t("boards.defaultTaskType")}
                                </Label>
                                <Select
                                    onValueChange={(value) => {
                                        if (
                                            value === "bug" ||
                                            value === "feature" ||
                                            value === "task"
                                        ) {
                                            setDefaultTaskType(value);
                                        }
                                    }}
                                    value={defaultTaskType}
                                >
                                    <SelectTrigger
                                        id={`board-default-type-${boardId}`}
                                    >
                                        <span>
                                            {t(`taskType.${defaultTaskType}`)}
                                        </span>
                                    </SelectTrigger>
                                    <SelectContent alignItemWithTrigger={false}>
                                        {BOARD_DEFAULT_TASK_TYPES.map(
                                            (type) => (
                                                <SelectItem
                                                    key={type}
                                                    value={type}
                                                >
                                                    {t(`taskType.${type}`)}
                                                </SelectItem>
                                            )
                                        )}
                                    </SelectContent>
                                </Select>
                                <p className="text-meta text-muted-foreground">
                                    {t("boards.defaultTaskTypeHint")}
                                </p>
                            </div>

                            {showAutoAssignToCreator ? (
                                <div className="flex items-start gap-3">
                                    <Checkbox
                                        checked={autoAssignToCreator}
                                        className="mt-0.5"
                                        id={`board-auto-assign-${boardId}`}
                                        onCheckedChange={(checked) => {
                                            setAutoAssignToCreator(
                                                checked === true
                                            );
                                        }}
                                    />
                                    <div className="flex min-w-0 flex-col gap-1">
                                        <Label
                                            className="cursor-pointer"
                                            htmlFor={`board-auto-assign-${boardId}`}
                                        >
                                            {t("boards.autoAssignToMe")}
                                        </Label>
                                        <p className="text-meta text-muted-foreground">
                                            {t("boards.autoAssignToMeHint")}
                                        </p>
                                    </div>
                                </div>
                            ) : undefined}

                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor={`board-patterns-${boardId}`}>
                                    {t("boards.allowedPatterns")}
                                </Label>
                                <Textarea
                                    className="min-h-24 font-mono text-sm"
                                    id={`board-patterns-${boardId}`}
                                    onChange={(event) =>
                                        setAllowedRaw(event.target.value)
                                    }
                                    placeholder={"feature/*\nfix/*"}
                                    value={allowedRaw}
                                />
                                <p className="text-meta text-muted-foreground">
                                    {t("boards.allowedPatternsHint")}
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                                <Button
                                    className="text-muted-foreground hover:text-destructive"
                                    disabled={!canDelete}
                                    onClick={onDelete}
                                    size="sm"
                                    variant="ghost"
                                >
                                    <Trash2 data-icon="inline-start" />
                                    {t("boards.delete")}
                                </Button>
                                <Button
                                    disabled={
                                        !dirty ||
                                        isSaving ||
                                        !name.trim() ||
                                        !baseBranch.trim()
                                    }
                                    onClick={() =>
                                        void onSave({
                                            allowed_head_patterns:
                                                parseAllowedHeadPatterns(
                                                    allowedRaw
                                                ),
                                            ...(showAutoAssignToCreator
                                                ? {
                                                      auto_assign_to_creator:
                                                          autoAssignToCreator,
                                                  }
                                                : {}),
                                            base_branch: baseBranch.trim(),
                                            default_task_type: defaultTaskType,
                                            name: name.trim(),
                                        })
                                    }
                                    size="sm"
                                    variant={dirty ? "default" : "secondary"}
                                >
                                    {t("boards.save")}
                                </Button>
                            </div>
                        </div>
                    </CollapsibleContent>
                </div>
            </Collapsible>
        </li>
    );
}
