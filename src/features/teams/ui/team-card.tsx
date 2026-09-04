import { useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, Settings, Users } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { TeamRow } from "@/features/teams/api/team-members-api";

import { Button } from "@/shared/shadcn/ui/button";
import { Card } from "@/shared/shadcn/ui/card";

type TeamCardProperties = {
    index?: number;
    team: TeamRow;
};

export function TeamCard({ index, team }: TeamCardProperties) {
    const { t } = useTranslation("home");
    const navigate = useNavigate();

    const openTeam = () => {
        void navigate({
            params: { teamId: team.id },
            to: "/teams/$teamId",
        });
    };

    return (
        <Card
            className="group relative cursor-pointer overflow-hidden rounded-none py-4 ring-border/60 transition-[transform,box-shadow,ring-color] duration-300 ease-(--ease-out-expo) hover:-translate-y-0.5 hover:ring-primary/50 focus-visible:ring-2 focus-visible:ring-ring"
            onClick={openTeam}
            onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openTeam();
                }
            }}
            role="link"
            tabIndex={0}
        >
            <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-0 w-0.5 origin-top scale-y-0 bg-primary transition-transform duration-500 ease-(--ease-out-expo) group-hover:scale-y-100 group-focus-visible:scale-y-100"
            />
            <div className="flex min-w-0 items-start gap-3 px-4">
                {index == undefined ? undefined : (
                    <span className="font-heading pt-0.5 text-[clamp(1.5rem,0.9rem+1.5vw,2rem)] font-bold leading-none tracking-[-0.04em] text-primary/35 tabular-nums transition-colors duration-300 ease-(--ease-out-expo) group-hover:text-primary/60">
                        {String(index + 1).padStart(2, "0")}
                    </span>
                )}

                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex min-w-0 items-center gap-2">
                        <Users
                            aria-hidden
                            className="size-4 shrink-0 text-muted-foreground transition-colors duration-300 ease-(--ease-out-expo) group-hover:text-primary"
                        />
                        <h3 className="min-w-0 truncate text-h3">
                            {team.name}
                        </h3>
                    </div>
                    <p className="text-meta text-muted-foreground">
                        {t("teamCardHint")}
                    </p>
                </div>

                <div className="flex shrink-0 items-center gap-0.5">
                    <Button
                        aria-label={t("openTeamSettings")}
                        className="opacity-0 transition-opacity duration-300 ease-(--ease-out-expo) group-hover:opacity-100 focus-visible:opacity-100"
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
                    <ArrowUpRight
                        aria-hidden
                        className="size-4 text-muted-foreground opacity-40 transition-[opacity,transform,color] duration-300 ease-(--ease-out-expo) group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary group-hover:opacity-100 group-focus-visible:opacity-100"
                    />
                </div>
            </div>
        </Card>
    );
}
