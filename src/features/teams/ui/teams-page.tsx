import { useNavigate } from "@tanstack/react-router";
import { Plus, Users } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import Skeleton from "react-loading-skeleton";

import { useTeams } from "@/features/teams/model/use-teams";
import { CreateTeamDialog } from "@/features/teams/ui/create-team-dialog";
import { TeamCard } from "@/features/teams/ui/team-card";
import { Alert, AlertDescription } from "@/shared/shadcn/ui/alert";
import { Button } from "@/shared/shadcn/ui/button";
import {
    Card,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/shared/shadcn/ui/card";
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/shared/shadcn/ui/empty";

const TEAM_SKELETON_COUNT = 4;

export function TeamsPage() {
    const { t } = useTranslation("home");
    const navigate = useNavigate();
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const { data: teams = [], error, isLoading } = useTeams();

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex min-w-0 flex-col gap-1">
                    <h1>{t("title")}</h1>
                    <p className="text-body text-muted-foreground">
                        {t("subtitle")}
                    </p>
                </div>
                <Button onClick={() => setIsCreateOpen(true)} type="button">
                    <Plus data-icon="inline-start" />
                    {t("createTeam")}
                </Button>
            </div>

            {isLoading && (
                <div
                    aria-busy="true"
                    aria-live="polite"
                    className="grid gap-4 sm:grid-cols-2"
                    role="status"
                >
                    {Array.from({ length: TEAM_SKELETON_COUNT }, (_, index) => (
                        <Card aria-hidden key={index}>
                            <CardHeader>
                                <CardTitle>
                                    <Skeleton />
                                </CardTitle>
                                <CardDescription>
                                    <Skeleton />
                                </CardDescription>
                            </CardHeader>
                        </Card>
                    ))}
                </div>
            )}

            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{t("teamsError")}</AlertDescription>
                </Alert>
            )}

            {!isLoading && !error && teams.length === 0 && (
                <Empty className="border border-dashed">
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <Users />
                        </EmptyMedia>
                        <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
                        <EmptyDescription>
                            {t("emptyDescription")}
                        </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                        <Button
                            onClick={() => setIsCreateOpen(true)}
                            type="button"
                            variant="outline"
                        >
                            <Plus data-icon="inline-start" />
                            {t("createTeam")}
                        </Button>
                    </EmptyContent>
                </Empty>
            )}

            {teams.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2">
                    {teams.map((team) => (
                        <TeamCard key={team.id} team={team} />
                    ))}
                </div>
            )}

            <CreateTeamDialog
                onCreated={(teamId) => {
                    void navigate({
                        params: { teamId },
                        to: "/teams/$teamId",
                    });
                }}
                onOpenChange={setIsCreateOpen}
                open={isCreateOpen}
            />
        </div>
    );
}
