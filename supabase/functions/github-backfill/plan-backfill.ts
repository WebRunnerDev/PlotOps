import type { GithubBranch, GithubPullRequest } from "./github-repo-api.ts";

import { normalizeGitReference } from "../_shared/task-key.ts";
import {
    type CandidateTask,
    matchTasks,
} from "../github-webhook/match-task.ts";

/**
 * Which open PRs and branches of one Repository refer to a Task at all
 * (linked PR / branch, or a task key in branch, title or body). Only these
 * are replayed through the webhook sync, which applies the auto-link rules.
 * Branches that head an open PR are left to the PR.
 */
export function planBackfill(
    tasks: CandidateTask[],
    github: { branches: GithubBranch[]; pulls: GithubPullRequest[] }
): { branches: string[]; pulls: GithubPullRequest[] } {
    const pulls = github.pulls.filter(
        (pr) =>
            matchTasks(tasks, {
                body: pr.body,
                headRef: pr.headRef,
                prNumber: pr.number,
                title: pr.title,
            }).length > 0
    );

    const prHeads = new Set(
        github.pulls.map((pr) => normalizeGitReference(pr.headRef))
    );
    const branches = github.branches
        .map((branch) => branch.name)
        .filter(
            (name) =>
                !prHeads.has(normalizeGitReference(name)) &&
                matchTasks(tasks, { headRef: name }).some(
                    (match) => match.by === "task_key"
                )
        );

    return { branches, pulls };
}
