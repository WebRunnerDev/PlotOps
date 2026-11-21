import { useAuth } from "@/features/auth/model/use-auth";
import { useProject } from "@/features/projects/model/use-projects";
import { useTaskPeekStore } from "@/features/tasks/model/task-peek-store";
import { TaskDrawer } from "@/features/tasks/ui/task-drawer";

/**
 * App-wide Task drawer for pages without a Board (Notifications, Home…).
 * Renders nothing while a page-owned Task drawer is mounted.
 */
export function TaskPeekDrawer() {
    const target = useTaskPeekStore((state) => state.target);
    const pageDrawerCount = useTaskPeekStore((state) => state.pageDrawerCount);
    const { githubAccessToken } = useAuth();
    const { data: project } = useProject(target?.projectId ?? "");

    if (!target || pageDrawerCount > 0) return null;

    return (
        <TaskDrawer
            boardId={target.boardId}
            githubToken={githubAccessToken}
            key={`${target.projectId}:${target.boardId}`}
            peek
            projectId={target.projectId}
            repositories={project?.repositories ?? []}
        />
    );
}
