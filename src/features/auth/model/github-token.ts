const STORAGE_KEY = "plotops_github_provider_token";
const GITHUB_USER_URL = "https://api.github.com/user";

let memoryToken: null | string = readStoredToken();
const listeners = new Set<() => void>();

export function clearGitHubAccessToken() {
    const hadToken = memoryToken !== null || readStoredToken() !== null;
    memoryToken = null;
    writeStoredToken(null);
    if (hadToken) {
        notifyListeners();
    }
}

export function getGitHubAccessToken(): null | string {
    return memoryToken;
}

export function setGitHubAccessToken(token: string) {
    if (memoryToken === token) {
        writeStoredToken(token);
        return;
    }
    memoryToken = token;
    writeStoredToken(token);
    notifyListeners();
}

export function subscribeGitHubAccessToken(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/** Probe GitHub; false only when GitHub rejects the token (401). */
export async function validateGitHubAccessToken(
    token: string,
    signal?: AbortSignal
): Promise<boolean> {
    try {
        const response = await fetch(GITHUB_USER_URL, {
            headers: {
                Accept: "application/vnd.github+json",
                Authorization: `Bearer ${token}`,
                "X-GitHub-Api-Version": "2022-11-28",
            },
            signal,
        });

        if (response.status === 401) {
            return false;
        }

        // Keep cached token on transient/non-auth failures (5xx, network-ish ok:false).
        return true;
    } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
            return true;
        }
        return true;
    }
}

function notifyListeners() {
    for (const listener of listeners) {
        listener();
    }
}

function readStoredToken(): null | string {
    try {
        return globalThis.localStorage.getItem(STORAGE_KEY);
    } catch {
        return null;
    }
}

function writeStoredToken(token: null | string) {
    try {
        if (token) {
            globalThis.localStorage.setItem(STORAGE_KEY, token);
        } else {
            globalThis.localStorage.removeItem(STORAGE_KEY);
        }
    } catch {
        // Storage may be unavailable (private mode / SSR); memory remains SoT.
    }
}
