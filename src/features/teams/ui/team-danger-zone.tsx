import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useProjectsByTeam } from "@/features/projects/model/use-projects";
import { useTeamAccess } from "@/features/teams/model/use-team-access";
import { useTeam } from "@/features/teams/model/use-team-members";
import { useDeleteTeam } from "@/features/teams/model/use-teams";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/shared/shadcn/ui/alert-dialog";
import { Button } from "@/shared/shadcn/ui/button";
import { Spinner } from "@/shared/shadcn/ui/spinner";

type TeamDangerZoneProperties = {
    teamId: string;
};

export function TeamDangerZone({ teamId }: TeamDangerZoneProperties) {
    const { t } = useTranslation("board");
    const navigate = useNavigate();
    const { canDeleteTeam } = useTeamAccess(teamId);
    const { data: team } = useTeam(teamId);
    const { data: projects = [], isLoading: projectsLoading } =
        useProjectsByTeam(teamId);
    const deleteTeam = useDeleteTeam();
    const [confirmOpen, setConfirmOpen] = useState(false);

    if (!canDeleteTeam) {
        return null;
    }

    const hasProjects = projects.length > 0;
    const canDeleteNow = !projectsLoading && !hasProjects;

    const handleConfirmDelete = async () => {
        try {
            await deleteTeam.mutateAsync(teamId);
            setConfirmOpen(false);
            toast.success(t("teamSettings.deleteSuccess"));
            void navigate({ to: "/home" });
        } catch {
            toast.error(
                hasProjects
                    ? t("teamSettings.deleteBlocked")
                    : t("teamSettings.deleteFailed")
            );
        }
    };

    return (
        <>
            <section
                aria-labelledby="team-settings-danger-heading"
                className="flex flex-col gap-5 border-t border-border pt-8 sm:gap-6 sm:pt-10"
            >
                <div className="flex min-w-0 flex-col gap-2">
                    <h2
                        className="text-h2 text-destructive"
                        id="team-settings-danger-heading"
                    >
                        {t("teamSettings.dangerTitle")}
                    </h2>
                    <div aria-hidden className="h-px w-12 bg-destructive/55" />
                    <p className="max-w-prose text-ui text-muted-foreground">
                        {hasProjects
                            ? t("teamSettings.deleteBlocked")
                            : t("teamSettings.dangerDescription")}
                    </p>
                </div>

                <div className="flex flex-col gap-4 rounded-xl border border-dashed border-destructive/45 bg-destructive/5 p-4 sm:p-5">
                    <Button
                        className="w-fit"
                        disabled={!canDeleteNow || deleteTeam.isPending}
                        onClick={() => setConfirmOpen(true)}
                        type="button"
                        variant="destructive"
                    >
                        {projectsLoading || deleteTeam.isPending ? (
                            <Spinner data-icon="inline-start" />
                        ) : null}
                        {t("teamSettings.delete")}
                    </Button>
                </div>
            </section>

            <AlertDialog
                onOpenChange={(open) => {
                    if (!open && !deleteTeam.isPending) {
                        setConfirmOpen(false);
                    }
                }}
                open={confirmOpen}
            >
                <AlertDialogContent size="sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {t("teamSettings.deleteTitle")}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {t("teamSettings.deleteDescription", {
                                name: team?.name ?? "",
                            })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleteTeam.isPending}>
                            {t("teamSettings.deleteCancel")}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            disabled={deleteTeam.isPending}
                            onClick={() => {
                                void handleConfirmDelete();
                            }}
                            variant="destructive"
                        >
                            {deleteTeam.isPending ? (
                                <Spinner data-icon="inline-start" />
                            ) : null}
                            {t("teamSettings.deleteConfirm")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
