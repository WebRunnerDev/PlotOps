/** Default page size for CI/CD workflow-run lists (GitHub Actions + mock). */
export const BUILDS_PAGE_SIZE = 30;

export function hasMoreBuilds(parameters: {
    page: number;
    perPage: number;
    totalCount: number;
}): boolean {
    const { page, perPage, totalCount } = parameters;
    return page * perPage < totalCount;
}
