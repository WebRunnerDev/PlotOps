import { useNavigate } from "@tanstack/react-router";
import { Check, ChevronsUpDown, LayoutGrid, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { BaseBranchDraft } from "@/features/boards/lib/base-branch-draft";
import type {
    BoardSettingsRepository,
    ProjectBoardRecord,
} from "@/features/boards/model/types";

import {
    buildCreateBoardInput,
    hasBlankBaseBranch,
    toBaseBranchDraft,
} from "@/features/boards/lib/base-branch-draft";
import { writeLastBoardId } from "@/features/boards/lib/last-board-storage";
import {
    useBoardMutations,
    useProjectBoards,
} from "@/features/boards/model/use-project-boards";
import { RepositoryBaseBranchFields } from "@/features/boards/ui/repository-base-branch-fields";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/shadcn/ui/button";
import { Checkbox } from "@/shared/shadcn/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shared/shadcn/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/shared/shadcn/ui/dropdown-menu";
import { Input } from "@/shared/shadcn/ui/input";
import { Label } from "@/shared/shadcn/ui/label";

type BoardSwitcherProperties = {
    boardId: string;
    canManage: boolean;
    /** Where selecting/creating a board navigates. Default: kanban board. */
    destination?: "backlog" | "board";
    projectId: string;
    /**
     * The Project's Repositories, oldest first. The Development Board option
     * (Base branch per Repository) shows only when non-empty.
     */
    repositories?: readonly BoardSettingsRepository[];
};

export function BoardSwitcher({
    boardId,
    canManage,
    destination = "board",
    projectId,
    repositories = [],
}: BoardSwitcherProperties) {
    const showGitBranchSettings = repositories.length > 0;
    const { t } = useTranslation("board");
    const navigate = useNavigate();
    const { data: boards = [], isLoading } = useProjectBoards(projectId);
    const { createBoard, isCreating } = useBoardMutations(projectId);
    const [createOpen, setCreateOpen] = useState(false);
    const [name, setName] = useState("");
    const [isDevelopment, setIsDevelopment] = useState(showGitBranchSettings);
    const [baseBranches, setBaseBranches] = useState<BaseBranchDraft>(() =>
        toBaseBranchDraft(repositories, [])
    );

    const current = boards.find((board) => board.id === boardId);
    const currentName =
        current?.name ??
        (isLoading ? t("boards.loading") : t("boards.unknown"));

    const goToBoard = (next: ProjectBoardRecord) => {
        writeLastBoardId(projectId, next.id);
        void navigate({
            params: { boardId: next.id, projectId },
            to:
                destination === "backlog"
                    ? "/projects/$projectId/boards/$boardId/backlog"
                    : "/projects/$projectId/boards/$boardId",
        });
    };

    const handleCreate = async () => {
        const board = await createBoard(
            name.trim() || t("boards.defaultNewName"),
            buildCreateBoardInput(repositories, isDevelopment, baseBranches)
        );
        setCreateOpen(false);
        setName("");
        setIsDevelopment(showGitBranchSettings);
        setBaseBranches(toBaseBranchDraft(repositories, []));
        goToBoard(board);
    };

    return (
        <>
            <div className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 text-meta text-muted-foreground">
                    {t("boards.label")}
                </span>
                <DropdownMenu>
                    <DropdownMenuTrigger
                        render={
                            <Button
                                aria-label={`${t("boards.label")}: ${currentName}`}
                                className="min-w-36 justify-between rounded-none border-primary/25 font-normal transition-colors duration-150 ease-[var(--ease-out-quart)] hover:border-primary/40 hover:bg-primary/5"
                                disabled={isLoading}
                                size="sm"
                                variant="outline"
                            />
                        }
                    >
                        <LayoutGrid
                            aria-hidden
                            className="opacity-70"
                            data-icon="inline-start"
                        />
                        <span className="min-w-0 truncate">{currentName}</span>
                        <ChevronsUpDown
                            aria-hidden
                            className="opacity-60"
                            data-icon="inline-end"
                        />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="min-w-48">
                        {boards.map((board) => (
                            <DropdownMenuItem
                                key={board.id}
                                onClick={() => goToBoard(board)}
                            >
                                <Check
                                    className={cn(
                                        "size-3.5",
                                        board.id === boardId
                                            ? "opacity-100"
                                            : "opacity-0"
                                    )}
                                />
                                <span className="truncate">{board.name}</span>
                            </DropdownMenuItem>
                        ))}
                        {canManage ? (
                            <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    onClick={() => {
                                        setIsDevelopment(showGitBranchSettings);
                                        setBaseBranches(
                                            toBaseBranchDraft(repositories, [])
                                        );
                                        setCreateOpen(true);
                                    }}
                                >
                                    <Plus className="size-3.5" />
                                    {t("boards.create")}
                                </DropdownMenuItem>
                            </>
                        ) : undefined}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

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
                            <Label htmlFor="board-name">
                                {t("boards.name")}
                            </Label>
                            <Input
                                id="board-name"
                                onChange={(event) =>
                                    setName(event.target.value)
                                }
                                placeholder={t("boards.namePlaceholder")}
                                value={name}
                            />
                        </div>
                        {showGitBranchSettings ? (
                            <>
                                <div className="flex items-start gap-3">
                                    <Checkbox
                                        checked={isDevelopment}
                                        className="mt-0.5"
                                        id="board-is-dev"
                                        onCheckedChange={(checked) => {
                                            setIsDevelopment(checked === true);
                                        }}
                                    />
                                    <div className="flex min-w-0 flex-col gap-1">
                                        <Label
                                            className="cursor-pointer"
                                            htmlFor="board-is-dev"
                                        >
                                            {t("boards.isDevelopment")}
                                        </Label>
                                        <p className="text-meta text-muted-foreground">
                                            {t("boards.isDevelopmentHint")}
                                        </p>
                                    </div>
                                </div>
                                {isDevelopment ? (
                                    <RepositoryBaseBranchFields
                                        idPrefix="board-base"
                                        onChange={(repositoryId, value) =>
                                            setBaseBranches((current) => ({
                                                ...current,
                                                [repositoryId]: value,
                                            }))
                                        }
                                        repositories={repositories}
                                        values={baseBranches}
                                    />
                                ) : undefined}
                            </>
                        ) : undefined}
                    </div>
                    <DialogFooter>
                        <Button
                            onClick={() => setCreateOpen(false)}
                            variant="ghost"
                        >
                            {t("boards.cancel")}
                        </Button>
                        <Button
                            disabled={
                                isCreating ||
                                (showGitBranchSettings &&
                                    isDevelopment &&
                                    hasBlankBaseBranch(
                                        repositories,
                                        baseBranches
                                    ))
                            }
                            onClick={() => void handleCreate()}
                        >
                            {t("boards.createConfirm")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
