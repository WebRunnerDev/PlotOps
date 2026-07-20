import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import {
    acceptInviteByToken,
    claimInviteByToken,
    getInviteByToken,
    type InvitePreview,
} from "@/features/projects/api/members-api";
import { useAuth } from "@/features/auth";
import { Alert, AlertDescription } from "@/shared/shadcn/ui/alert";
import { Button } from "@/shared/shadcn/ui/button";
import { Spinner } from "@/shared/shadcn/ui/spinner";

export const Route = createFileRoute("/invite/$token")({
    component: InviteAcceptPage,
});

function InviteAcceptPage() {
    const { token } = Route.useParams();
    const { t } = useTranslation("board");
    const { isLoading: authLoading, user } = useAuth();
    const navigate = useNavigate();

    const [invite, setInvite] = useState<InvitePreview | null>(null);
    const [loadError, setLoadError] = useState(false);
    const [isLoadingInvite, setIsLoadingInvite] = useState(true);
    const [isActing, setIsActing] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setIsLoadingInvite(true);
        void getInviteByToken(token).then(({ data, error }) => {
            if (cancelled) return;
            const row = Array.isArray(data) ? data[0] : data;
            if (error || !row) {
                setLoadError(true);
                setInvite(null);
            } else {
                setInvite(row as InvitePreview);
                setLoadError(false);
            }
            setIsLoadingInvite(false);
        });
        return () => {
            cancelled = true;
        };
    }, [token]);

    const emailMatches =
        Boolean(user?.email) &&
        Boolean(invite?.email) &&
        user!.email!.toLowerCase() === invite!.email.toLowerCase();

    const onAccept = async () => {
        if (!invite || isActing) return;
        setIsActing(true);
        try {
            const { error } = await acceptInviteByToken(token);
            if (error) throw error;
            globalThis.sessionStorage.removeItem("plotops_pending_invite");
            toast.success(t("invite.acceptSuccess"));
            void navigate({
                params: { projectId: invite.project_id },
                to: "/projects/$projectId",
            });
        } catch {
            toast.error(t("invite.acceptFailed"));
        } finally {
            setIsActing(false);
        }
    };

    const onClaim = async () => {
        if (!invite || isActing) return;
        setIsActing(true);
        try {
            const { error } = await claimInviteByToken(token);
            if (error) throw error;
            toast.success(t("invite.claimSuccess"));
        } catch {
            toast.error(t("invite.claimFailed"));
        } finally {
            setIsActing(false);
        }
    };

    const goSignIn = () => {
        globalThis.sessionStorage.setItem("plotops_pending_invite", token);
    };

    const goSignUp = () => {
        globalThis.sessionStorage.setItem("plotops_pending_invite", token);
    };

    if (authLoading || isLoadingInvite) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center">
                <Spinner className="size-8 text-primary" />
            </div>
        );
    }

    if (loadError || !invite) {
        return (
            <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-16">
                <Alert variant="destructive">
                    <AlertDescription>{t("invite.notFound")}</AlertDescription>
                </Alert>
                <Button nativeButton={false} render={<Link to="/home" />}>
                    {t("invite.goHome")}
                </Button>
            </div>
        );
    }

    return (
        <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-16">
            <header className="flex flex-col gap-1">
                <p className="text-meta text-muted-foreground">
                    {t("invite.eyebrow")}
                </p>
                <h1 className="text-h1">{invite.project_name}</h1>
                <p className="text-ui text-muted-foreground">
                    {t("invite.asRole", {
                        role: t(`members.roles.${invite.role}`),
                    })}
                </p>
            </header>

            <div className="border border-border p-4 text-ui">
                <p>{t("invite.forEmail", { email: invite.email })}</p>
                {invite.expires_at ? (
                    <p className="mt-1 text-muted-foreground">
                        {t("invite.expires", {
                            date: new Date(invite.expires_at).toLocaleString(),
                        })}
                    </p>
                ) : (
                    <p className="mt-1 text-muted-foreground">
                        {t("invite.noExpiry")}
                    </p>
                )}
            </div>

            {invite.status !== "pending" ? (
                <Alert>
                    <AlertDescription>
                        {t(`invite.status.${invite.status}`)}
                    </AlertDescription>
                </Alert>
            ) : undefined}

            {!user ? (
                <div className="flex flex-col gap-3">
                    <p className="text-ui text-muted-foreground">
                        {t("invite.createAccountFirst")}
                    </p>
                    <Button
                        nativeButton={false}
                        onClick={goSignUp}
                        render={
                            <Link
                                search={{ email: invite.email }}
                                to="/sign-up"
                            />
                        }
                    >
                        {t("invite.createAccount")}
                    </Button>
                    <Button
                        nativeButton={false}
                        onClick={goSignIn}
                        render={<Link to="/sign-in" />}
                        variant="outline"
                    >
                        {t("invite.signIn")}
                    </Button>
                </div>
            ) : invite.status === "pending" ? (
                <div className="flex flex-col gap-3">
                    <p className="text-ui text-muted-foreground">
                        {t("invite.signedInAs", {
                            email: user.email ?? t("members.unknownUser"),
                        })}
                    </p>
                    {emailMatches ? (
                        <Button
                            disabled={isActing}
                            onClick={() => void onAccept()}
                            type="button"
                        >
                            {isActing ? (
                                <Spinner className="size-4" />
                            ) : undefined}
                            {t("invite.accept")}
                        </Button>
                    ) : (
                        <>
                            <Alert>
                                <AlertDescription>
                                    {t("invite.emailMismatch")}
                                </AlertDescription>
                            </Alert>
                            <Button
                                disabled={isActing}
                                onClick={() => void onClaim()}
                                type="button"
                                variant="outline"
                            >
                                {isActing ? (
                                    <Spinner className="size-4" />
                                ) : undefined}
                                {t("invite.claim")}
                            </Button>
                        </>
                    )}
                </div>
            ) : undefined}
        </div>
    );
}
