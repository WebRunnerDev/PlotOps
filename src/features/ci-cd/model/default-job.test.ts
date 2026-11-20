import { describe, expect, it } from "vitest";

import type { BuildJob } from "@/features/ci-cd/model/types";

import { pickDefaultJob } from "@/features/ci-cd/model/default-job";

const job = (id: string, status: BuildJob["status"]): BuildJob => ({
    id,
    name: id,
    status,
});

describe("pickDefaultJob", () => {
    it("opens on the first failed job", () => {
        expect(
            pickDefaultJob([
                job("check", "success"),
                job("shard-2", "failure"),
                job("e2e", "running"),
                job("gate", "failure"),
            ])?.id
        ).toBe("shard-2");
    });

    it("falls back to a running, then a queued job", () => {
        expect(
            pickDefaultJob([
                job("a", "success"),
                job("b", "queued"),
                job("c", "running"),
            ])?.id
        ).toBe("c");
        expect(
            pickDefaultJob([job("a", "success"), job("b", "queued")])?.id
        ).toBe("b");
    });

    it("opens on the first job of a green run, and on nothing without jobs", () => {
        expect(
            pickDefaultJob([job("a", "success"), job("b", "success")])?.id
        ).toBe("a");
        expect(pickDefaultJob([])).toBeUndefined();
    });
});
