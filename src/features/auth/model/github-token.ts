const STORAGE_KEY = "plotops_github_provider_token";
const GITHUB_USER_URL = "https://api.github.com/user";

type StoredToken = {
    ownerUserId: string;
    token: string;
};

let memoryToken: null | string = null;
let memoryOwnerUserId: null | string = null;
const listeners = new Set<() => void>();

// Do not hydrate from storage at import time — only restore after
// retainGitHubAccessTokenForUser(currentUserId) / setGitHubAccessToken.

export function clearGitHubAccessToken() {
    const hadToken = memoryToken !== null || readStoredToken() !== null;
    memoryToken = null;
    memoryOwnerUserId = null;
    writeStoredToken(null);
    if (hadToken) {
        notifyListeners();
    }
}

export function getGitHubAccessToken(): null | string {
    return memoryToken;
}

export function getGitHubAccessTokenOwnerId(): null | string {
    return memoryOwnerUserId;
}

/**
 * Keep the cached provider token only when it belongs to `userId`.
 * Otherwise clear memory + storage (account switch / unbound legacy).
 */
export function retainGitHubAccessTokenForUser(userId: string): null | string {
    if (memoryToken === null) {
        hydrateFromStorage();
    }

    if (!memoryToken || memoryOwnerUserId !== userId) {
        clearGitHubAccessToken();
        return null;
    }

    return memoryToken;
}

export function setGitHubAccessToken(token: string, ownerUserId: string) {
    if (memoryToken === token && memoryOwnerUserId === ownerUserId) {
        writeStoredToken({ ownerUserId, token });
        return;
    }
    memoryToken = token;
    memoryOwnerUserId = ownerUserId;
    writeStoredToken({ ownerUserId, token });
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

function hydrateFromStorage() {
    const stored = readStoredToken();
    memoryToken = stored?.token ?? null;
    memoryOwnerUserId = stored?.ownerUserId ?? null;
}

function notifyListeners() {
    for (const listener of listeners) {
        listener();
    }
}

function readStoredToken(): null | StoredToken {
    try {
        const raw = globalThis.localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;

        try {
            const parsed: unknown = JSON.parse(raw);
            if (
                parsed &&
                typeof parsed === "object" &&
                "token" in parsed &&
                "ownerUserId" in parsed &&
                typeof (parsed as StoredToken).token === "string" &&
                typeof (parsed as StoredToken).ownerUserId === "string" &&
                (parsed as StoredToken).token.length > 0 &&
                (parsed as StoredToken).ownerUserId.length > 0
            ) {
                return {
                    ownerUserId: (parsed as StoredToken).ownerUserId,
                    token: (parsed as StoredToken).token,
                };
            }
        } catch {
            // Legacy plain-string tokens are unbound — discard.
        }

        globalThis.localStorage.removeItem(STORAGE_KEY);
        return null;
    } catch {
        return null;
    }
}

function writeStoredToken(payload: null | StoredToken) {
    try {
        if (payload) {
            globalThis.localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(payload)
            );
        } else {
            globalThis.localStorage.removeItem(STORAGE_KEY);
        }
    } catch {
        // Storage may be unavailable (private mode / SSR); memory remains SoT.
    }
}
