export type CanFetchGitDataInput = {
    branchName: string | undefined;
    isGuest: boolean;
    repoFullName: string | undefined;
    token: null | string;
};

export type CanFetchPullRequestFilesInput = {
    isGuest: boolean;
    prNumber: number | undefined;
    repoFullName: string | undefined;
    token: null | string;
};

/**
 * Whether branch commits / PRs may be loaded for this session.
 * Guests have no provider_token — fixtures still load when repo+branch are set.
 */
export function canFetchGitData({
    branchName,
    isGuest,
    repoFullName,
    token,
}: CanFetchGitDataInput): boolean {
    const hasAuth = Boolean(token) || isGuest;
    return Boolean(hasAuth && repoFullName && branchName);
}

export function canFetchPullRequestFiles({
    isGuest,
    prNumber,
    repoFullName,
    token,
}: CanFetchPullRequestFilesInput): boolean {
    const hasAuth = Boolean(token) || isGuest;
    return Boolean(hasAuth && repoFullName && prNumber != undefined);
}
