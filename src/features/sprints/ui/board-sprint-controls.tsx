import { Play } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useProjectAccess } from "@/features/projects/model/use-project-access";
import { resolveEffectiveBoardSprintScope } from "@/features/sprints/model/resolve-effective-board-sprint-scope";
import { useBoardSprints } from "@/features/sprints/model/use-sprints";
import { useSprintsUiStore } from "@/features/sprints/model/use-sprints-ui-store";
import { StartSprintDialog } from "@/features/sprints/ui/sprint-lifecycle-dialogs";
import { useBoardTasks } from "@/features/tasks";
import { Button } from "@/shared/shadcn/ui/button";
import { ButtonGroup } from "@/shared/shadcn/ui/button-group";

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
    const {
        data: sprintsData,
        error: sprintsQueryError,
        refetch: refetchSprints,
    } = useBoardSprints(boardId);
    const sprints = sprintsData ?? [];
    const sprintsError =
        Boolean(sprintsQueryError) && sprintsData === undefined;
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

    const effectiveScope = resolveEffectiveBoardSprintScope({
        boardSprintScope,
        hasActiveSprint: active !== undefined,
    });

    const showStart = canManage && !active && Boolean(startCandidate);

    if (sprintsError) {
        return (
            <div className="flex h-6 flex-wrap items-stretch gap-2">
                <p className="text-meta text-destructive">
                    {t("sprints.loadFailed")}
                </p>
                <Button
                    onClick={() => void refetchSprints()}
                    size="xs"
                    type="button"
                    variant="outline"
                >
                    {t("sprints.retry")}
                </Button>
            </div>
        );
    }

    return (
        <div className="flex flex-wrap items-stretch gap-2">
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

            <ButtonGroup aria-label={t("sprints.scopeLabel")} className="h-6">
                <Button
                    aria-pressed={effectiveScope === "active"}
                    className="aria-pressed:bg-secondary aria-pressed:text-secondary-foreground"
                    disabled={!active}
                    onClick={() => setBoardSprintScope("active")}
                    size="xs"
                    type="button"
                    variant="outline"
                >
                    {t("sprints.scopeActive")}
                    {active ? (
                        <span className="text-meta text-muted-foreground">
                            {active.name}
                        </span>
                    ) : null}
                </Button>
                <Button
                    aria-pressed={effectiveScope === "entire"}
                    className="aria-pressed:bg-secondary aria-pressed:text-secondary-foreground"
                    onClick={() => setBoardSprintScope("entire")}
                    size="xs"
                    type="button"
                    variant="outline"
                >
                    {t("sprints.scopeEntire")}
                </Button>
            </ButtonGroup>

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
