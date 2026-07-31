/** Build a GitHub tree URL when the project has a linked html_url. */
export function buildGithubTreeUrl(
    githubHtmlUrl: null | string | undefined,
    branch: string
): string | undefined {
    if (!githubHtmlUrl) return undefined;
    const encoded = branch
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/");
    return `${githubHtmlUrl.replace(/\/$/, "")}/tree/${encoded}`;
}
