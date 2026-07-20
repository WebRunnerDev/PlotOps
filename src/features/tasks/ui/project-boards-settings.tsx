import { ExternalLink, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { boardHasTasks } from "@/features/tasks/api/boards-api";
import {
    parseAllowedHeadPatterns,
} from "@/features/tasks/lib/allowed-head-patterns";
import {
    useBoardMutations,
    useProjectBoards,
} from "@/features/tasks/model/use-project-boards";
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
import { Button } from "@/shared/shadcn/ui/button";
import { Input } from "@/shared/shadcn/ui/input";
import { Label } from "@/shared/shadcn/ui/label";
import { Spinner } from "@/shared/shadcn/ui/spinner";
import { Textarea } from "@/shared/shadcn/ui/textarea";

type ProjectBoardsSettingsProperties = {
    projectId: string;
};

export function ProjectBoardsSettings({
    projectId,
}: ProjectBoardsSettingsProperties) {
    const { t } = useTranslation("board");
    const navigate = useNavigate();
    const { data: boards = [] } = useProjectBoards(projectId);
    const { deleteBoard, isDeleting, isUpdating, updateBoard } =
        useBoardMutations(projectId);
    const [deleteId, setDeleteId] = useState<null | string>(null);

    const { data: hasTasks, isLoading: isCheckingTasks } = useQuery({
        enabled: Boolean(deleteId),
        queryFn: () => boardHasTasks(deleteId!),
        queryKey: ["board-has-tasks", deleteId],
    });

    const openBoard = (boardId: string) => {
        setDeleteId(null);
        void navigate({
            params: { boardId, projectId },
            to: "/projects/$projectId/boards/$boardId",
        });
    };

    return (
        <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
                <h2 className="text-lg font-medium">{t("boards.settingsTitle")}</h2>
                <p className="text-sm text-muted-foreground">
                    {t("boards.settingsDescription")}
                </p>
            </div>

            <ul className="flex flex-col gap-4">
                {boards.map((board) => (
                    <BoardSettingsCard
                        key={board.id}
                        boardId={board.id}
                        canDelete={boards.length > 1}
                        initialAllowed={board.allowedHeadPatterns.join("\n")}
                        initialBase={board.baseBranch}
                        initialName={board.name}
                        isSaving={isUpdating}
                        onDelete={() => setDeleteId(board.id)}
                        onSave={async (patch) => {
                            await updateBoard(board.id, patch);
                            toast.success(t("boards.saved"));
                        }}
                    />
                ))}
            </ul>

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
                        <AlertDialogCancel>{t("boards.cancel")}</AlertDialogCancel>
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
                                            const remaining = boards.filter(
                                                (board) => board.id !== boardId,
                                            );
                                            const next = remaining[0];
                                            if (next) {
                                                void navigate({
                                                    params: {
                                                        boardId: next.id,
                                                        projectId,
                                                    },
                                                    to: "/projects/$projectId/boards/$boardId",
                                                });
                                            }
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
    initialAllowed,
    initialBase,
    initialName,
    isSaving,
    onDelete,
    onSave,
}: {
    boardId: string;
    canDelete: boolean;
    initialAllowed: string;
    initialBase: string;
    initialName: string;
    isSaving: boolean;
    onDelete: () => void;
    onSave: (patch: {
        allowed_head_patterns?: string[];
        base_branch?: string;
        name?: string;
    }) => Promise<void>;
}) {
    const { t } = useTranslation("board");
    const [name, setName] = useState(initialName);
    const [baseBranch, setBaseBranch] = useState(initialBase);
    const [allowedRaw, setAllowedRaw] = useState(initialAllowed);

    useEffect(() => {
        setName(initialName);
        setBaseBranch(initialBase);
        setAllowedRaw(initialAllowed);
    }, [initialAllowed, initialBase, initialName]);

    const dirty =
        name.trim() !== initialName ||
        baseBranch.trim() !== initialBase ||
        parseAllowedHeadPatterns(allowedRaw).join("\n") !==
        parseAllowedHeadPatterns(initialAllowed).join("\n");

    return (
        <li className="flex flex-col gap-3 rounded-lg border border-border p-4">
            <div className="flex flex-col gap-1.5">
                <Label htmlFor={`board-name-${boardId}`}>
                    {t("boards.name")}
                </Label>
                <Input
                    id={`board-name-${boardId}`}
                    onChange={(event) => setName(event.target.value)}
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
                    onChange={(event) => setBaseBranch(event.target.value)}
                    value={baseBranch}
                />
                <p className="text-xs text-muted-foreground">
                    {t("boards.baseBranchHint")}
                </p>
            </div>
            <div className="flex flex-col gap-1.5">
                <Label htmlFor={`board-patterns-${boardId}`}>
                    {t("boards.allowedPatterns")}
                </Label>
                <Textarea
                    className="min-h-20 font-mono text-sm"
                    id={`board-patterns-${boardId}`}
                    onChange={(event) => setAllowedRaw(event.target.value)}
                    placeholder={"feature/*\nfix/*"}
                    value={allowedRaw}
                />
                <p className="text-xs text-muted-foreground">
                    {t("boards.allowedPatternsHint")}
                </p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <Button
                    disabled={!canDelete}
                    onClick={onDelete}
                    size="sm"
                    variant="ghost"
                >
                    <Trash2 data-icon="inline-start" />
                    {t("boards.delete")}
                </Button>
                <Button
                    disabled={!dirty || isSaving || !name.trim() || !baseBranch.trim()}
                    onClick={() =>
                        void onSave({
                            allowed_head_patterns:
                                parseAllowedHeadPatterns(allowedRaw),
                            base_branch: baseBranch.trim(),
                            name: name.trim(),
                        })
                    }
                    size="sm"
                >
                    {t("boards.save")}
                </Button>
            </div>
        </li>
    );
}
