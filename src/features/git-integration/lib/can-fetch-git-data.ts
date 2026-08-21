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

export type CanFetchTaskGitTabInput = {
    isGuest: boolean;
    repoFullName: string | undefined;
    taskKey: string | undefined;
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

/** Whether PR check runs may be loaded (same gate as PR files/diff). */
export function canFetchPullRequestChecks(
    input: CanFetchPullRequestFilesInput
): boolean {
    return canFetchPullRequestFiles(input);
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

/** Whether the task Git tab may load (smart commits by task key; branch optional). */
export function canFetchTaskGitTab({
    isGuest,
    repoFullName,
    taskKey,
    token,
}: CanFetchTaskGitTabInput): boolean {
    const hasAuth = Boolean(token) || isGuest;
    return Boolean(hasAuth && repoFullName && taskKey);
}
