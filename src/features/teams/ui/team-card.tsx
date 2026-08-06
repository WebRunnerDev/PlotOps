import { useNavigate } from "@tanstack/react-router";
import { Settings, Users } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { TeamRow } from "@/features/teams/api/team-members-api";

import { Button } from "@/shared/shadcn/ui/button";
import {
    Card,
    CardAction,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/shared/shadcn/ui/card";

type TeamCardProperties = {
    team: TeamRow;
};

export function TeamCard({ team }: TeamCardProperties) {
    const { t } = useTranslation("home");
    const navigate = useNavigate();

    return (
        <Card
            className="group cursor-pointer transition-colors hover:ring-primary/40"
            onClick={() =>
                void navigate({
                    params: { teamId: team.id },
                    to: "/teams/$teamId",
                })
            }
            onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    void navigate({
                        params: { teamId: team.id },
                        to: "/teams/$teamId",
                    });
                }
            }}
            role="link"
            tabIndex={0}
        >
            <CardHeader>
                <CardTitle className="flex min-w-0 items-center gap-2">
                    <Users
                        aria-hidden
                        className="size-4 shrink-0 text-muted-foreground"
                    />
                    <span className="truncate">{team.name}</span>
                </CardTitle>
                <CardDescription className="text-meta">
                    {t("teamCardHint")}
                </CardDescription>
                <CardAction>
                    <Button
                        aria-label={t("openTeamSettings")}
                        className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                        onClick={(event) => {
                            event.stopPropagation();
                            void navigate({
                                params: { teamId: team.id },
                                to: "/teams/$teamId/settings",
                            });
                        }}
                        size="icon-sm"
                        type="button"
                        variant="ghost"
                    >
                        <Settings />
                    </Button>
                </CardAction>
            </CardHeader>
        </Card>
    );
}
