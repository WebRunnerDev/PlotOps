const STORAGE_KEY = "plotops_github_provider_token";

export function clearGitHubAccessToken() {
    globalThis.localStorage.removeItem(STORAGE_KEY);
}

export function getGitHubAccessToken(): null | string {
    return globalThis.localStorage.getItem(STORAGE_KEY);
}

export function setGitHubAccessToken(token: string) {
    globalThis.localStorage.setItem(STORAGE_KEY, token);
}
