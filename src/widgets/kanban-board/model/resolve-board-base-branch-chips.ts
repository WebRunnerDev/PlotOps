import { buildGithubTreeUrl } from "@/features/projects/model/github-project-links";

export type BoardBaseBranchChip = {
    branch: string;
    /** Repository short name; null when the Project has one Repository. */
    repoLabel: null | string;
    repositoryId: string;
    url: string | undefined;
};

type ChipRepository = {
    github_full_name: string;
    github_html_url: string;
    id: string;
};

/**
 * One chip per Repository for a Development Board's Base branches (ADR 0035),
 * in the Project's Repository order. The repo name is shown only when there is
 * more than one, so a single-repo Board looks as before. Regular Boards and
 * Repositories without a Base branch row get no chip.
 */
export function resolveBoardBaseBranchChips(input: {
    isDevelopment: boolean;
    repositories: readonly ChipRepository[];
    repositoryBaseBranches: readonly {
        baseBranch: string;
        repositoryId: string;
    }[];
}): BoardBaseBranchChip[] {
    if (!input.isDevelopment) return [];
    const branchByRepo = new Map(
        input.repositoryBaseBranches.map((row) => [
            row.repositoryId,
            row.baseBranch,
        ])
    );
    const labelled = input.repositories.length > 1;

    return input.repositories.flatMap((repository) => {
        const branch = branchByRepo.get(repository.id);
        if (!branch) return [];
        return [
            {
                branch,
                repoLabel: labelled
                    ? (repository.github_full_name.split("/").pop() ??
                      repository.github_full_name)
                    : null,
                repositoryId: repository.id,
                url: buildGithubTreeUrl(repository.github_html_url, branch),
            },
        ];
    });
}
