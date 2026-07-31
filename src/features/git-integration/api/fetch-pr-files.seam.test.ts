import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchPullRequestFiles } from "@/features/git-integration/api/github-git-api";

afterEach(() => {
    vi.unstubAllGlobals();
});

function filePage(count: number, page: number) {
    return Array.from({ length: count }, (_, index) => ({
        additions: 1,
        blob_url: "https://example.com",
        deletions: 0,
        filename: `p${page}-f${index}.ts`,
        status: "modified",
    }));
}

describe("fetchPullRequestFiles", () => {
    it("sets truncated when the page cap is hit with a full last page", async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input));
            const page = Number(url.searchParams.get("page") ?? "1");
            return {
                json: async () => filePage(100, page),
                ok: true,
            };
        });
        vi.stubGlobal("fetch", fetchMock);

        const result = await fetchPullRequestFiles("o/r", 1, "token");

        expect(result.truncated).toBe(true);
        expect(result.files).toHaveLength(3000);
        expect(fetchMock).toHaveBeenCalledTimes(30);
    });

    it("does not mark truncated when pagination ends early", async () => {
        const fetchMock = vi.fn(async () => ({
            json: async () => filePage(3, 1),
            ok: true,
        }));
        vi.stubGlobal("fetch", fetchMock);

        const result = await fetchPullRequestFiles("o/r", 1, "token");

        expect(result.truncated).toBe(false);
        expect(result.files).toHaveLength(3);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
