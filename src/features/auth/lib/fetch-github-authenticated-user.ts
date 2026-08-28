const GITHUB_USER_URL = "https://api.github.com/user";

export type GitHubAuthenticatedUser = {
    id: number;
    login: string;
};

/** Resolves the GitHub login for the bearer token (GET /user). */
export async function fetchGitHubAuthenticatedUser(
    token: string,
    signal?: AbortSignal
): Promise<GitHubAuthenticatedUser | null> {
    try {
        const response = await fetch(GITHUB_USER_URL, {
            headers: {
                Accept: "application/vnd.github+json",
                Authorization: `Bearer ${token}`,
                "X-GitHub-Api-Version": "2022-11-28",
            },
            signal,
        });

        if (!response.ok) return null;

        const data: unknown = await response.json();
        if (
            !data ||
            typeof data !== "object" ||
            typeof (data as GitHubAuthenticatedUser).login !== "string" ||
            typeof (data as GitHubAuthenticatedUser).id !== "number"
        ) {
            return null;
        }

        const login = (data as GitHubAuthenticatedUser).login.trim();
        if (!login) return null;

        return {
            id: (data as GitHubAuthenticatedUser).id,
            login,
        };
    } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
            throw error;
        }
        return null;
    }
}
