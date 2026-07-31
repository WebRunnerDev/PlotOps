import { Play } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useProjectAccess } from "@/features/projects/model/use-project-access";
import { useBoardSprints } from "@/features/sprints/model/use-sprints";
import { useSprintsUiStore } from "@/features/sprints/model/use-sprints-ui-store";
import { StartSprintDialog } from "@/features/sprints/ui/sprint-lifecycle-dialogs";
import { useBoardTasks } from "@/features/tasks";
import { Button } from "@/shared/shadcn/ui/button";

type BoardSprintControlsProperties = {
    boardId: string;
    projectId: string;
};

export function BoardSprintControls({
    boardId,
    projectId,
}: BoardSprintControlsProperties) {
    const { t } = useTranslation("board");
    const { canManageBoard, isSettled } = useProjectAccess(projectId);
    const canManage = isSettled && canManageBoard;
    const { tasks } = useBoardTasks(projectId, boardId);
    const { data: sprints = [] } = useBoardSprints(boardId);
    const boardSprintScope = useSprintsUiStore(
        (state) => state.boardSprintScope
    );
    const setBoardSprintScope = useSprintsUiStore(
        (state) => state.setBoardSprintScope
    );
    const [startOpen, setStartOpen] = useState(false);

    const active = sprints.find((sprint) => sprint.state === "active");
    const drafts = useMemo(
        () => sprints.filter((sprint) => sprint.state === "draft"),
        [sprints]
    );
    const startCandidate = drafts[0];
    const startTaskCount = startCandidate
        ? tasks.filter((task) => task.sprintId === startCandidate.id).length
        : 0;

    const effectiveScope =
        boardSprintScope === "active" && !active ? "entire" : boardSprintScope;

    const showStart = canManage && !active && Boolean(startCandidate);

    return (
        <div className="flex flex-wrap items-center gap-2">
            {showStart && startCandidate ? (
                <Button
                    onClick={() => setStartOpen(true)}
                    size="xs"
                    type="button"
                >
                    <Play data-icon="inline-start" />
                    {t("sprints.startNamed", { name: startCandidate.name })}
                </Button>
            ) : null}

            <div
                aria-label={t("sprints.scopeLabel")}
                className="inline-flex rounded-md border border-border p-0.5"
                role="group"
            >
                <Button
                    disabled={!active}
                    onClick={() => setBoardSprintScope("active")}
                    size="xs"
                    type="button"
                    variant={
                        effectiveScope === "active" ? "secondary" : "ghost"
                    }
                >
                    {t("sprints.scopeActive")}
                    {active ? (
                        <span className="text-meta text-muted-foreground">
                            {active.name}
                        </span>
                    ) : null}
                </Button>
                <Button
                    onClick={() => setBoardSprintScope("entire")}
                    size="xs"
                    type="button"
                    variant={
                        effectiveScope === "entire" ? "secondary" : "ghost"
                    }
                >
                    {t("sprints.scopeEntire")}
                </Button>
            </div>

            {startCandidate ? (
                <StartSprintDialog
                    boardId={boardId}
                    onOpenChange={setStartOpen}
                    open={startOpen}
                    projectId={projectId}
                    sprint={startCandidate}
                    taskCount={startTaskCount}
                />
            ) : null}
        </div>
    );
}
