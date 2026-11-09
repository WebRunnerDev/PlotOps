import type {
    BoardRepositoryBaseBranch,
    BoardSettingsRepository,
    CreateBoardInput,
} from "@/features/boards/model/types";

/** Base branch being edited, keyed by Repository id. */
export type BaseBranchDraft = Record<string, string>;

/** The create-dialog payload: a Base branch per Repository for a Development Board. */
export function buildCreateBoardInput(
    repositories: readonly BoardSettingsRepository[],
    isDevelopment: boolean,
    draft: BaseBranchDraft
): CreateBoardInput {
    const asDevelopment = isDevelopment && repositories.length > 0;
    return {
        isDevelopment: asDevelopment,
        repositoryBaseBranches: asDevelopment
            ? fromBaseBranchDraft(repositories, draft)
            : undefined,
    };
}

export function fillBlankBaseBranches(
    repositories: readonly BoardSettingsRepository[],
    draft: BaseBranchDraft
): BaseBranchDraft {
    return Object.fromEntries(
        repositories.map((repository) => [
            repository.id,
            draft[repository.id]?.trim() || repository.defaultBranch,
        ])
    );
}

export function fromBaseBranchDraft(
    repositories: readonly BoardSettingsRepository[],
    draft: BaseBranchDraft
): BoardRepositoryBaseBranch[] {
    return repositories.map((repository) => ({
        baseBranch: (draft[repository.id] ?? "").trim(),
        repositoryId: repository.id,
    }));
}

export function hasBlankBaseBranch(
    repositories: readonly BoardSettingsRepository[],
    draft: BaseBranchDraft
): boolean {
    return repositories.some(
        (repository) => !(draft[repository.id] ?? "").trim()
    );
}

/** Distinct Base branches in Repository order, e.g. `main · develop`. */
export function summarizeBaseBranches(
    repositories: readonly BoardSettingsRepository[],
    draft: BaseBranchDraft
): string {
    const branches = repositories
        .map((repository) => (draft[repository.id] ?? "").trim())
        .filter(Boolean);
    return [...new Set(branches)].join(" · ");
}

/**
 * Draft per Repository: the stored Base branch, else the Repository's default
 * branch (what the trigger seeds when the Board becomes a Development Board).
 */
export function toBaseBranchDraft(
    repositories: readonly BoardSettingsRepository[],
    stored: readonly BoardRepositoryBaseBranch[]
): BaseBranchDraft {
    const byRepository = new Map(
        stored.map((entry) => [entry.repositoryId, entry.baseBranch])
    );
    return Object.fromEntries(
        repositories.map((repository) => [
            repository.id,
            byRepository.get(repository.id) ?? repository.defaultBranch,
        ])
    );
}

/**
 * Project Repository rows (`project_repositories`) as Board settings need
 * them. Structural so `boards` stays a leaf module.
 */
export function toBoardSettingsRepositories(
    repositories: readonly {
        github_default_branch: string;
        github_full_name: string;
        id: string;
    }[]
): BoardSettingsRepository[] {
    return repositories.map((repository) => ({
        defaultBranch: repository.github_default_branch,
        fullName: repository.github_full_name,
        id: repository.id,
    }));
}
