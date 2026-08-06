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
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/shared/shadcn/ui/card";
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
            <Card className="border-destructive/40">
                <CardHeader>
                    <CardTitle className="text-destructive">
                        {t("teamSettings.dangerTitle")}
                    </CardTitle>
                    <CardDescription>
                        {hasProjects
                            ? t("teamSettings.deleteBlocked")
                            : t("teamSettings.dangerDescription")}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button
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
                </CardContent>
            </Card>

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
