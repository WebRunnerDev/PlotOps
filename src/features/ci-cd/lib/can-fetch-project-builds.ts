import { projectHasGithubRepo } from "@/features/projects/model/project-github-gate";

export type CanFetchProjectBuildsInput = {
    githubAccessToken: null | string;
    /** Project.github_repo_id — null/absent means name-only (no live Actions). */
    githubRepoId: null | number | undefined;
    isGuest: boolean;
    projectId: string;
};

/** Whether the project builds query may run for this session. */
export function canFetchProjectBuilds({
    githubAccessToken,
    githubRepoId,
    isGuest,
    projectId,
}: CanFetchProjectBuildsInput): boolean {
    if (!projectId || !projectHasGithubRepo(githubRepoId)) {
        return false;
    }
    return Boolean(githubAccessToken || isGuest);
}
