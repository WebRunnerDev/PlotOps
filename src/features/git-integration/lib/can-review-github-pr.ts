import type { ProjectAccessRole } from "@/features/projects/model/access";
import type { Task } from "@/features/tasks/model/types";

export type CanReviewGithubPrInput = {
    isGuest: boolean;
    role: null | ProjectAccessRole;
    task: Pick<Task, "archivedAt">;
    userId: null | string | undefined;
};

/**
 * PlotOps gate for in-app PR Approve (ADR 0022 review gate).
 * Broader than Open/Merge: Manager/Contributor may Approve any task on the Project.
 * GitHub still enforces whether that user may approve (e.g. own-PR rules).
 */
export function canReviewGithubPr(input: CanReviewGithubPrInput): boolean {
    const { isGuest, role, task, userId } = input;

    if (isGuest) return false;
    if (task.archivedAt) return false;
    if (!userId) return false;
    if (!role || role === "viewer") return false;

    return (
        role === "owner" ||
        role === "admin" ||
        role === "manager" ||
        role === "contributor"
    );
}
