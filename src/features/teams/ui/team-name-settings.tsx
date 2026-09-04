import { type FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useTeamAccess } from "@/features/teams/model/use-team-access";
import { useTeam } from "@/features/teams/model/use-team-members";
import { useUpdateTeam } from "@/features/teams/model/use-teams";
import { Button } from "@/shared/shadcn/ui/button";
import { Input } from "@/shared/shadcn/ui/input";
import { Label } from "@/shared/shadcn/ui/label";
import { Spinner } from "@/shared/shadcn/ui/spinner";

type TeamNameSettingsProperties = {
    teamId: string;
};

export function TeamNameSettings({ teamId }: TeamNameSettingsProperties) {
    const { t } = useTranslation("board");
    const { t: tHome } = useTranslation("home");
    const { role } = useTeamAccess(teamId);
    const { data: team } = useTeam(teamId);
    const updateTeam = useUpdateTeam();
    const [name, setName] = useState(team?.name ?? "");

    useEffect(() => {
        setName(team?.name ?? "");
    }, [team?.name]);

    if (role !== "owner") {
        return null;
    }

    const trimmed = name.trim();
    const isDirty = team && trimmed !== team.name;
    const canSave = isDirty && trimmed.length > 0 && !updateTeam.isPending;

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (!canSave) return;

        try {
            await updateTeam.mutateAsync({ name: trimmed, teamId });
            toast.success(t("teamSettings.nameSaved"));
        } catch {
            toast.error(t("teamSettings.nameSaveFailed"));
        }
    };

    return (
        <section
            aria-labelledby="team-settings-name-heading"
            className="flex flex-col gap-5 border-t border-border pt-8 sm:gap-6 sm:pt-10"
        >
            <div className="flex min-w-0 flex-col gap-2">
                <h2 className="text-h2" id="team-settings-name-heading">
                    {t("teamSettings.nameTitle")}
                </h2>
                <div aria-hidden className="h-px w-12 bg-primary/60" />
                <p className="max-w-prose text-ui text-muted-foreground">
                    {t("teamSettings.nameDescription")}
                </p>
            </div>

            <form
                className="flex flex-col gap-4 rounded-xl border border-border/80 bg-card/60 p-4 ring-1 ring-foreground/5 sm:p-5"
                onSubmit={(event) => void handleSubmit(event)}
            >
                <div className="flex min-w-0 flex-col gap-2">
                    <Label htmlFor="team-settings-name">
                        {tHome("teamNameLabel")}
                    </Label>
                    <Input
                        className="font-heading text-base tracking-tight"
                        disabled={updateTeam.isPending}
                        id="team-settings-name"
                        onChange={(event) => setName(event.target.value)}
                        placeholder={tHome("teamNamePlaceholder")}
                        value={name}
                    />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <Button disabled={!canSave} type="submit">
                        {updateTeam.isPending ? (
                            <Spinner data-icon="inline-start" />
                        ) : null}
                        {t("teamSettings.nameSave")}
                    </Button>
                    {isDirty ? (
                        <span className="font-mono text-meta text-amber-500/90">
                            {t("boards.unsaved")}
                        </span>
                    ) : null}
                </div>
            </form>
        </section>
    );
}
