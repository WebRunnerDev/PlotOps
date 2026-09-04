import type { ProjectAccessRole } from "@/features/projects/model/access";
import type { Task } from "@/features/tasks/model/types";

export type CanWriteGithubPrInput = {
    isGuest: boolean;
    role: null | ProjectAccessRole;
    task: Pick<Task, "archivedAt" | "assignee" | "author">;
    userId: null | string | undefined;
};

/**
 * PlotOps gate for in-app Open PR / Merge / Close (ADR 0022).
 * GitHub still enforces repo rights via the user's provider_token.
 */
export function canWriteGithubPr(input: CanWriteGithubPrInput): boolean {
    const { isGuest, role, task, userId } = input;

    if (isGuest) return false;
    if (task.archivedAt) return false;
    if (!userId) return false;
    if (!role || role === "viewer") return false;

    if (role === "owner" || role === "admin") return true;

    if (role === "manager" || role === "contributor") {
        return isTaskAuthorOrAssignee(task, userId);
    }

    return false;
}

function isTaskAuthorOrAssignee(
    task: Pick<Task, "assignee" | "author">,
    userId: string
): boolean {
    return task.author?.id === userId || task.assignee?.id === userId;
}
