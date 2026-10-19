/** GitHub username rules: alphanumerics and single inner hyphens, max 39 chars. */
const GITHUB_LOGIN_PATTERN = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

export type ReviewerLoginStatus =
    "already_requested" | "author" | "invalid" | "ok";

export type ReviewerLoginStatusInput = {
    authorLogin: null | string;
    login: string;
    requestedLogins: readonly string[];
};

/** Typed reviewer input → bare login (`@octocat` → `octocat`), or undefined when malformed. */
export function normalizeReviewerLogin(raw: string): string | undefined {
    const login = raw.trim().replace(/^@/, "");
    return GITHUB_LOGIN_PATTERN.test(login) ? login : undefined;
}

/**
 * Whether a login can be put in a review request. Catches the cases GitHub
 * would reject (PR author) or silently no-op (already requested) before the call.
 */
export function reviewerLoginStatus(
    input: ReviewerLoginStatusInput
): ReviewerLoginStatus {
    const login = normalizeReviewerLogin(input.login);
    if (!login) return "invalid";
    if (input.authorLogin && sameLogin(input.authorLogin, login)) {
        return "author";
    }
    if (
        input.requestedLogins.some((requested) => sameLogin(requested, login))
    ) {
        return "already_requested";
    }
    return "ok";
}

/** GitHub logins are case-insensitive. */
export function sameLogin(a: string, b: string): boolean {
    return a.toLowerCase() === b.toLowerCase();
}
