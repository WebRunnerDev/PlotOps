export type CanFetchProjectBuildsInput = {
    githubAccessToken: null | string;
    isGuest: boolean;
    projectId: string;
};

/** Whether the project builds query may run for this session. */
export function canFetchProjectBuilds({
    githubAccessToken,
    isGuest,
    projectId,
}: CanFetchProjectBuildsInput): boolean {
    return Boolean(projectId && (githubAccessToken || isGuest));
}
