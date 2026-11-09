import { useTranslation } from "react-i18next";

import type { BaseBranchDraft } from "@/features/boards/lib/base-branch-draft";
import type { BoardSettingsRepository } from "@/features/boards/model/types";

import { cn } from "@/shared/lib/utils";
import { Input } from "@/shared/shadcn/ui/input";
import { Label } from "@/shared/shadcn/ui/label";

/**
 * Base branch inputs, one per Repository. A single Repository keeps the
 * one-field look; several get the Repository name as each field's label.
 */
export function RepositoryBaseBranchFields({
    idPrefix,
    onChange,
    repositories,
    values,
}: {
    idPrefix: string;
    onChange: (repositoryId: string, value: string) => void;
    repositories: readonly BoardSettingsRepository[];
    values: BaseBranchDraft;
}) {
    const { t } = useTranslation("board");
    const single = repositories.length === 1;

    return (
        <fieldset className="flex min-w-0 flex-col gap-1.5">
            <legend className="mb-1.5 text-sm leading-none font-medium">
                {t("boards.baseBranch")}
            </legend>
            <div className={cn("grid gap-2", !single && "sm:grid-cols-2")}>
                {repositories.map((repository) => {
                    const id = `${idPrefix}-${repository.id}`;
                    return (
                        <div
                            className="flex min-w-0 flex-col gap-1"
                            key={repository.id}
                        >
                            {single ? undefined : (
                                <Label
                                    className="min-w-0 truncate font-mono text-meta font-normal normal-case text-muted-foreground"
                                    htmlFor={id}
                                >
                                    {repository.fullName}
                                </Label>
                            )}
                            <Input
                                aria-label={
                                    single
                                        ? t("boards.baseBranch")
                                        : t("boards.baseBranchFor", {
                                              repository: repository.fullName,
                                          })
                                }
                                className="font-mono text-sm"
                                id={id}
                                onChange={(event) =>
                                    onChange(repository.id, event.target.value)
                                }
                                placeholder={repository.defaultBranch}
                                value={values[repository.id] ?? ""}
                            />
                        </div>
                    );
                })}
            </div>
            <p className="text-meta text-muted-foreground">
                {single
                    ? t("boards.baseBranchHint")
                    : t("boards.baseBranchPerRepositoryHint")}
            </p>
        </fieldset>
    );
}
