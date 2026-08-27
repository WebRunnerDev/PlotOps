import { type FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useTeamAccess } from "@/features/teams/model/use-team-access";
import { useTeam } from "@/features/teams/model/use-team-members";
import { useUpdateTeam } from "@/features/teams/model/use-teams";
import { Button } from "@/shared/shadcn/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/shared/shadcn/ui/card";
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
        <Card>
            <CardHeader>
                <CardTitle>{t("teamSettings.nameTitle")}</CardTitle>
                <CardDescription>
                    {t("teamSettings.nameDescription")}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form
                    className="flex flex-col gap-4"
                    onSubmit={(event) => void handleSubmit(event)}
                >
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="team-settings-name">
                            {tHome("teamNameLabel")}
                        </Label>
                        <Input
                            disabled={updateTeam.isPending}
                            id="team-settings-name"
                            onChange={(event) => setName(event.target.value)}
                            placeholder={tHome("teamNamePlaceholder")}
                            value={name}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Button disabled={!canSave} type="submit">
                            {updateTeam.isPending ? (
                                <Spinner data-icon="inline-start" />
                            ) : null}
                            {t("teamSettings.nameSave")}
                        </Button>
                        {isDirty ? (
                            <span className="text-meta text-muted-foreground">
                                {t("boards.unsaved")}
                            </span>
                        ) : null}
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
