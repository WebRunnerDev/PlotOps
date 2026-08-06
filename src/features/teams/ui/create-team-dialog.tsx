import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useCreateTeam } from "@/features/teams/model/use-teams";
import { Button } from "@/shared/shadcn/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shared/shadcn/ui/dialog";
import { Input } from "@/shared/shadcn/ui/input";
import { Label } from "@/shared/shadcn/ui/label";
import { Spinner } from "@/shared/shadcn/ui/spinner";

type CreateTeamDialogProperties = {
    onCreated: (teamId: string) => void;
    onOpenChange: (open: boolean) => void;
    open: boolean;
};

export function CreateTeamDialog({
    onCreated,
    onOpenChange,
    open,
}: CreateTeamDialogProperties) {
    const { t } = useTranslation("home");
    const [name, setName] = useState("");
    const createTeam = useCreateTeam();
    const trimmed = name.trim();
    const canSubmit = trimmed.length > 0 && !createTeam.isPending;

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (!canSubmit) return;

        try {
            const team = await createTeam.mutateAsync(trimmed);
            setName("");
            onOpenChange(false);
            onCreated(team.id);
        } catch {
            toast.error(t("createTeamFailed"));
        }
    };

    return (
        <Dialog
            onOpenChange={(next) => {
                if (!next && createTeam.isPending) return;
                if (!next) setName("");
                onOpenChange(next);
            }}
            open={open}
        >
            <DialogContent className="sm:max-w-md">
                <form onSubmit={(event) => void handleSubmit(event)}>
                    <DialogHeader>
                        <DialogTitle>{t("createTeamTitle")}</DialogTitle>
                        <DialogDescription>
                            {t("createTeamSubtitle")}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-2 py-4">
                        <Label htmlFor="team-name">{t("teamNameLabel")}</Label>
                        <Input
                            autoFocus
                            disabled={createTeam.isPending}
                            id="team-name"
                            onChange={(event) => setName(event.target.value)}
                            placeholder={t("teamNamePlaceholder")}
                            value={name}
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            disabled={createTeam.isPending}
                            onClick={() => onOpenChange(false)}
                            type="button"
                            variant="outline"
                        >
                            {t("createTeamCancel")}
                        </Button>
                        <Button disabled={!canSubmit} type="submit">
                            {createTeam.isPending ? (
                                <Spinner data-icon="inline-start" />
                            ) : null}
                            {t("createTeamConfirm")}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
