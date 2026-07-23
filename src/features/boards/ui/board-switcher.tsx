import { useNavigate } from "@tanstack/react-router";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { ProjectBoardRecord } from "@/features/boards/model/types";

import {
    useBoardMutations,
    useProjectBoards,
} from "@/features/boards/model/use-project-boards";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/shadcn/ui/button";
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
    defaultBaseBranch: string;
    projectId: string;
};

export function BoardSwitcher({
    boardId,
    canManage,
    defaultBaseBranch,
    projectId,
}: BoardSwitcherProperties) {
    const { t } = useTranslation("board");
    const navigate = useNavigate();
    const { data: boards = [], isLoading } = useProjectBoards(projectId);
    const { createBoard, isCreating } = useBoardMutations(projectId);
    const [createOpen, setCreateOpen] = useState(false);
    const [name, setName] = useState("");
    const [baseBranch, setBaseBranch] = useState(defaultBaseBranch);

    const current = boards.find((board) => board.id === boardId);

    const goToBoard = (next: ProjectBoardRecord) => {
        void navigate({
            params: { boardId: next.id, projectId },
            to: "/projects/$projectId/boards/$boardId",
        });
    };

    const handleCreate = async () => {
        const board = await createBoard(
            name.trim() || t("boards.defaultNewName"),
            baseBranch.trim() || defaultBaseBranch || "main"
        );
        setCreateOpen(false);
        setName("");
        setBaseBranch(defaultBaseBranch);
        goToBoard(board);
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger
                    render={
                        <Button
                            className="min-w-40 justify-between font-normal"
                            disabled={isLoading}
                            size="sm"
                            variant="outline"
                        />
                    }
                >
                    <span className="truncate">
                        {current?.name ?? t("boards.loading")}
                    </span>
                    <ChevronsUpDown className="size-3.5 opacity-60" />
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
                                    setBaseBranch(defaultBaseBranch);
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
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="board-base">
                                {t("boards.baseBranch")}
                            </Label>
                            <Input
                                className="font-mono text-sm"
                                id="board-base"
                                onChange={(event) =>
                                    setBaseBranch(event.target.value)
                                }
                                placeholder="main"
                                value={baseBranch}
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
                        >
                            {t("boards.createConfirm")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
