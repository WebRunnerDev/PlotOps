import { type FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { Project } from "@/features/projects/model/types";

import { useRenameProject } from "@/features/projects/model/use-projects";
import { Button } from "@/shared/shadcn/ui/button";
import { Input } from "@/shared/shadcn/ui/input";
import { Label } from "@/shared/shadcn/ui/label";
import { Spinner } from "@/shared/shadcn/ui/spinner";

type ProjectNameSettingsProperties = {
    /** Owner/Admin — `can_manage_project_settings` (RLS `projects_update_managers`). */
    canManage: boolean;
    project: Project;
};

/**
 * Project Settings → Project: rename the Project. The slug does not change.
 * Hidden for Roles that cannot manage Project settings.
 */
export function ProjectNameSettings({
    canManage,
    project,
}: ProjectNameSettingsProperties) {
    const { t } = useTranslation("board");
    const { t: tHome } = useTranslation("home");
    const rename = useRenameProject(project.id);
    const [name, setName] = useState(project.name);

    useEffect(() => {
        setName(project.name);
    }, [project.name]);

    if (!canManage) {
        return null;
    }

    const trimmed = name.trim();
    const isDirty = trimmed !== project.name;
    const canSave = isDirty && trimmed.length > 0 && !rename.isPending;

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (!canSave) return;

        try {
            await rename.mutateAsync(trimmed);
            toast.success(t("settings.project.nameSaved"));
        } catch {
            toast.error(t("settings.project.nameSaveFailed"));
        }
    };

    return (
        <section
            aria-labelledby="project-settings-name-heading"
            className="motion-reveal border border-border bg-card/60 p-5 backdrop-blur-sm [animation-delay:200ms] sm:p-6"
        >
            <div className="flex min-w-0 flex-col gap-2">
                <h2 className="text-h2" id="project-settings-name-heading">
                    {t("settings.project.title")}
                </h2>
                <p className="max-w-prose text-ui text-muted-foreground">
                    {t("settings.project.description")}
                </p>
            </div>

            <form
                className="mt-5 flex flex-col gap-4"
                onSubmit={(event) => void handleSubmit(event)}
            >
                <div className="flex min-w-0 flex-col gap-2">
                    <Label htmlFor="project-settings-name">
                        {t("settings.project.nameLabel")}
                    </Label>
                    <Input
                        aria-invalid={trimmed.length === 0}
                        className="font-heading text-base tracking-tight"
                        disabled={rename.isPending}
                        id="project-settings-name"
                        onChange={(event) => setName(event.target.value)}
                        placeholder={tHome("projectNamePlaceholder")}
                        value={name}
                    />
                    {trimmed.length === 0 ? (
                        <p className="text-meta text-destructive">
                            {t("settings.project.nameRequired")}
                        </p>
                    ) : undefined}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <Button disabled={!canSave} type="submit">
                        {rename.isPending ? (
                            <Spinner data-icon="inline-start" />
                        ) : undefined}
                        {t("settings.project.nameSave")}
                    </Button>
                    {isDirty ? (
                        <span className="font-mono text-meta text-amber-500/90">
                            {t("boards.unsaved")}
                        </span>
                    ) : undefined}
                </div>
            </form>
        </section>
    );
}
