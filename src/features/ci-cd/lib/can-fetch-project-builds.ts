export type CanFetchProjectBuildsInput = {
    githubAccessToken: null | string;
    isGuest: boolean;
    projectId: string;
    /** Linked Repositories — none means there are no Actions runs to show. */
    repositoryCount: number;
};

/** Whether the project builds query may run for this session. */
export function canFetchProjectBuilds({
    githubAccessToken,
    isGuest,
    projectId,
    repositoryCount,
}: CanFetchProjectBuildsInput): boolean {
    if (!projectId || repositoryCount === 0) {
        return false;
    }
    return Boolean(githubAccessToken || isGuest);
}
