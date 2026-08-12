import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useTeamAccess } from "@/features/teams/model/use-team-access";
import { useTeam } from "@/features/teams/model/use-team-members";
import { TeamDangerZone } from "@/features/teams/ui/team-danger-zone";
import { TeamMembersSettings } from "@/features/teams/ui/team-members-settings";
import { Alert, AlertDescription } from "@/shared/shadcn/ui/alert";
import { Button } from "@/shared/shadcn/ui/button";
import { Spinner } from "@/shared/shadcn/ui/spinner";

export const Route = createFileRoute("/(main)/teams/$teamId/settings")({
    component: TeamSettingsRoute,
});

function TeamSettingsRoute() {
    const { teamId } = Route.useParams();
    const router = useRouter();
    const { t } = useTranslation("board");
    const { t: tCommon } = useTranslation("common");
    const { data: team, error, isLoading } = useTeam(teamId);
    const {
        canManageMembers,
        canView,
        isError: accessError,
        isLoading: accessLoading,
    } = useTeamAccess(teamId);

    if (isLoading || accessLoading) {
        return (
            <div className="flex justify-center py-16">
                <Spinner className="size-8 text-primary" />
            </div>
        );
    }

    if (accessError || error || !team) {
        return (
            <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-4 px-4 py-4">
                <Alert variant="destructive">
                    <AlertDescription>
                        {t("teamSettings.loadFailed")}
                    </AlertDescription>
                </Alert>
                <Button nativeButton={false} render={<Link to="/home" />}>
                    {t("invite.goHome")}
                </Button>
            </div>
        );
    }

    if (!canManageMembers && !canView) {
        return (
            <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-4 px-4 py-4">
                <Alert variant="destructive">
                    <AlertDescription>
                        {t("teamSettings.noAccess")}
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-4 overflow-y-auto px-4 py-4">
            <header className="flex flex-col gap-1 border-b border-border pb-3">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <Button
                        className="shrink-0 text-muted-foreground"
                        onClick={() => router.history.back()}
                        size="sm"
                        type="button"
                        variant="ghost"
                    >
                        <ArrowLeft data-icon="inline-start" />
                        {tCommon("back")}
                    </Button>
                    <h1 className="text-sm font-semibold">
                        {t("teamSettings.title")}
                    </h1>
                </div>
                <p className="truncate font-mono text-meta text-muted-foreground">
                    {team.name}
                </p>
            </header>
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
                <TeamMembersSettings teamId={teamId} />
                <TeamDangerZone teamId={teamId} />
            </div>
        </div>
    );
}
