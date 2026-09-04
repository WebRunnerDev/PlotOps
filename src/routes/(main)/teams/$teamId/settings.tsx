import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useTeamAccess } from "@/features/teams/model/use-team-access";
import { useTeam } from "@/features/teams/model/use-team-members";
import { TeamDangerZone } from "@/features/teams/ui/team-danger-zone";
import { TeamMembersSettings } from "@/features/teams/ui/team-members-settings";
import { TeamNameSettings } from "@/features/teams/ui/team-name-settings";
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
        isSettled,
    } = useTeamAccess(teamId);

    if (isLoading || accessLoading || !isSettled) {
        return (
            <div className="flex justify-center py-16">
                <Spinner className="size-8 text-primary" />
            </div>
        );
    }

    if (accessError || error || !team) {
        return (
            <div className="relative mx-auto flex h-full w-full max-w-6xl flex-col gap-4 px-4 py-8">
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
            <div className="relative mx-auto flex h-full w-full max-w-6xl flex-col gap-4 px-4 py-8">
                <Alert variant="destructive">
                    <AlertDescription>
                        {t("teamSettings.noAccess")}
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="relative mx-auto flex h-full w-full min-w-0 max-w-6xl flex-col gap-10 overflow-y-auto px-4 py-8 scrollbar-board sm:gap-12 sm:py-10">
            <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 -top-8 h-72 bg-auth-atmosphere opacity-85 sm:-top-10 sm:h-80"
            />

            <header className="relative flex min-w-0 flex-col gap-5 motion-reveal sm:gap-6">
                <Button
                    className="w-fit shrink-0 text-muted-foreground"
                    onClick={() => router.history.back()}
                    size="sm"
                    type="button"
                    variant="ghost"
                >
                    <ArrowLeft data-icon="inline-start" />
                    {tCommon("back")}
                </Button>

                <div className="flex min-w-0 flex-col gap-3 sm:gap-4">
                    <p className="font-mono text-meta text-primary uppercase tracking-[0.14em]">
                        {t("teamSettings.title")}
                    </p>
                    <h1 className="min-w-0 text-h1 text-balance wrap-break-word">
                        {team.name}
                    </h1>
                    <div aria-hidden className="h-px w-14 bg-primary/70" />
                    <p className="max-w-xl text-body text-muted-foreground">
                        {t("teamSettings.subtitle")}
                    </p>
                </div>
            </header>

            <div className="relative flex flex-col gap-10 sm:gap-12">
                <div className="motion-reveal [animation-delay:120ms]">
                    <TeamNameSettings teamId={teamId} />
                </div>
                <div className="motion-reveal [animation-delay:220ms]">
                    <TeamMembersSettings teamId={teamId} />
                </div>
                <div className="motion-reveal [animation-delay:320ms]">
                    <TeamDangerZone teamId={teamId} />
                </div>
            </div>
        </div>
    );
}
