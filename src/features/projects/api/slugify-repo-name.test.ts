import { describe, expect, it } from "vitest";

import { slugifyRepoName } from "./projects-api";

describe("slugifyRepoName", () => {
    it("slugifies owner/name to a stable project slug", () => {
        expect(slugifyRepoName("acme/widgets")).toBe("acme-widgets");
        expect(slugifyRepoName("Acme/Widgets")).toBe("acme-widgets");
    });

    it("hardens empty results to a non-empty fallback", () => {
        expect(slugifyRepoName("")).toBe("repo");
        expect(slugifyRepoName("___")).toBe("repo");
        expect(slugifyRepoName("---")).toBe("repo");
    });
});
