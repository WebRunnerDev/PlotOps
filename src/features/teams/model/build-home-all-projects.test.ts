import { describe, expect, it } from "vitest";

import type { Project } from "@/features/projects/model/types";

import { buildHomeAllProjects } from "./build-home-all-projects";

function project(
    overrides: Partial<Project> & Pick<Project, "id" | "name" | "team_id">
): Project {
    return {
        created_at: "2026-01-01T00:00:00Z",
        description: null,
        github_default_branch: "main",
        github_full_name: null,
        github_html_url: null,
        github_repo_id: null,
        is_private: false,
        owner_id: "owner",
        slug: overrides.name.toLowerCase(),
        updated_at: "2026-01-01T00:00:00Z",
        ...overrides,
    };
}

describe("buildHomeAllProjects", () => {
    it("enriches projects with Team names and sorts by team then name", () => {
        const rows = buildHomeAllProjects(
            [
                project({ id: "p2", name: "zeta", team_id: "t-beta" }),
                project({ id: "p1", name: "alpha", team_id: "t-alpha" }),
                project({ id: "p3", name: "beta", team_id: "t-alpha" }),
            ],
            new Map([
                ["t-alpha", "Alpha Team"],
                ["t-beta", "Beta Team"],
            ])
        );

        expect(rows.map((row) => [row.teamName, row.project.name])).toEqual([
            ["Alpha Team", "alpha"],
            ["Alpha Team", "beta"],
            ["Beta Team", "zeta"],
        ]);
    });

    it("uses empty Team name when Team is missing from the map", () => {
        const rows = buildHomeAllProjects(
            [project({ id: "p1", name: "orphan", team_id: "missing" })],
            new Map()
        );

        expect(rows).toEqual([
            {
                project: expect.objectContaining({ id: "p1" }),
                teamName: "",
            },
        ]);
    });
});
