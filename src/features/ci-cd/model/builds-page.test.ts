import { describe, expect, it } from "vitest";

import {
    BUILDS_PAGE_SIZE,
    hasMoreBuilds,
} from "@/features/ci-cd/model/builds-page";

describe("CI/CD builds page helpers", () => {
    it("exports a stable default page size", () => {
        expect(BUILDS_PAGE_SIZE).toBe(30);
    });

    it("detects when another page remains", () => {
        expect(hasMoreBuilds({ page: 1, perPage: 30, totalCount: 31 })).toBe(
            true
        );
        expect(hasMoreBuilds({ page: 1, perPage: 30, totalCount: 30 })).toBe(
            false
        );
        expect(hasMoreBuilds({ page: 2, perPage: 30, totalCount: 60 })).toBe(
            false
        );
    });
});
