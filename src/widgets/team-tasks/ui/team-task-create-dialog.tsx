import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useBoardColumns, useProjectBoards } from "@/features/boards";
import {
    TASK_TITLE_MAX_LENGTH,
    taskKeys,
    useBoardTasks,
    useTasksUiStore,
} from "@/features/tasks";
import { Button } from "@/shared/shadcn/ui/button";
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

type TeamTaskCreateDialogProperties = {
    onOpenChange: (open: boolean) => void;
    open: boolean;
    projects: Array<{ id: string; name: string }>;
    teamId: string;
};

/**
 * New Task from Team Tasks: pick the Project and Board first, then hand off to
 * the Board's own create path (first column, Board default Task type) and open
 * the new Task in its Project.
 */
export function TeamTaskCreateDialog({
    onOpenChange,
    open,
    projects,
    teamId,
}: TeamTaskCreateDialogProperties) {
    const { t } = useTranslation("board");
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const selectTask = useTasksUiStore((state) => state.selectTask);
    const [pickedProjectId, setPickedProjectId] = useState("");
    const [pickedBoardId, setPickedBoardId] = useState("");
    const [title, setTitle] = useState("");
    const [isCreating, setIsCreating] = useState(false);

    // A single-Project Team has nothing to choose.
    const projectId =
        pickedProjectId || (projects.length === 1 ? projects[0]!.id : "");
    const { data: boards = [], isLoading: boardsLoading } = useProjectBoards(
        open ? projectId : ""
    );
    const boardId =
        boards.find((board) => board.id === pickedBoardId)?.id ??
        (boards.length === 1 ? boards[0]!.id : "");
    const { columns, columnsReady } = useBoardColumns(
        open ? projectId : "",
        open ? boardId : ""
    );
    const { createTask } = useBoardTasks(
        open ? projectId : "",
        open ? boardId : ""
    );

    const project = projects.find((item) => item.id === projectId);
    const board = boards.find((item) => item.id === boardId);
    const firstColumn = columns[0];
    const trimmedTitle = title.trim();
    const canSubmit =
        Boolean(projectId && boardId && firstColumn && trimmedTitle) &&
        !isCreating;

    const reset = () => {
        setPickedProjectId("");
        setPickedBoardId("");
        setTitle("");
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!canSubmit || !firstColumn) return;

        setIsCreating(true);
        try {
            const task = await createTask(firstColumn.id, trimmedTitle);
            void queryClient.invalidateQueries({
                queryKey: taskKeys.team(teamId),
            });
            reset();
            onOpenChange(false);
            selectTask(task.id);
            void navigate({
                params: { boardId, projectId },
                search: { task: task.key },
                to: "/projects/$projectId/boards/$boardId",
            });
        } catch {
            toast.error(t("teamTasks.create.failed"));
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <Dialog
            onOpenChange={(next) => {
                if (!next && isCreating) return;
                if (!next) reset();
                onOpenChange(next);
            }}
            open={open}
        >
            <DialogContent className="sm:max-w-md">
                <form
                    className="flex flex-col gap-4"
                    onSubmit={(event) => void handleSubmit(event)}
                >
                    <DialogHeader>
                        <DialogTitle>{t("teamTasks.create.title")}</DialogTitle>
                        <DialogDescription>
                            {t("teamTasks.create.description")}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="team-task-create-project">
                            {t("teamTasks.columns.project")}
                        </Label>
                        <Select
                            disabled={isCreating}
                            onValueChange={(value) => {
                                if (typeof value !== "string") return;
                                setPickedProjectId(value);
                                setPickedBoardId("");
                            }}
                            value={projectId}
                        >
                            <SelectTrigger
                                className="w-full"
                                id="team-task-create-project"
                            >
                                <span className="min-w-0 truncate">
                                    {project?.name ??
                                        t("teamTasks.create.pickProject")}
                                </span>
                            </SelectTrigger>
                            <SelectContent alignItemWithTrigger={false}>
                                {projects.map((item) => (
                                    <SelectItem key={item.id} value={item.id}>
                                        {item.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="team-task-create-board">
                            {t("fields.board")}
                        </Label>
                        <Select
                            disabled={
                                isCreating || !projectId || boards.length === 0
                            }
                            onValueChange={(value) => {
                                if (typeof value !== "string") return;
                                setPickedBoardId(value);
                            }}
                            value={boardId}
                        >
                            <SelectTrigger
                                className="w-full"
                                id="team-task-create-board"
                            >
                                <span className="min-w-0 truncate">
                                    {board?.name ??
                                        (boardsLoading ? (
                                            <Spinner />
                                        ) : (
                                            t("teamTasks.create.pickBoard")
                                        ))}
                                </span>
                            </SelectTrigger>
                            <SelectContent alignItemWithTrigger={false}>
                                {boards.map((item) => (
                                    <SelectItem key={item.id} value={item.id}>
                                        {item.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {boardId && columnsReady && !firstColumn ? (
                            <p className="text-meta text-destructive">
                                {t("teamTasks.create.noColumns")}
                            </p>
                        ) : undefined}
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="team-task-create-title">
                            {t("fields.title")}
                        </Label>
                        <Input
                            disabled={isCreating}
                            id="team-task-create-title"
                            maxLength={TASK_TITLE_MAX_LENGTH}
                            onChange={(event) => setTitle(event.target.value)}
                            placeholder={t("teamTasks.create.titlePlaceholder")}
                            value={title}
                        />
                    </div>

                    <DialogFooter>
                        <Button
                            disabled={isCreating}
                            onClick={() => {
                                reset();
                                onOpenChange(false);
                            }}
                            type="button"
                            variant="outline"
                        >
                            {t("teamTasks.create.cancel")}
                        </Button>
                        <Button disabled={!canSubmit} type="submit">
                            {isCreating ? (
                                <Spinner data-icon="inline-start" />
                            ) : undefined}
                            {t("teamTasks.create.submit")}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
