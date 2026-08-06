import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useAuth } from "@/features/auth";
import {
    acceptInviteByToken,
    claimInviteByToken,
    getInviteByToken,
    type InvitePreview,
} from "@/features/projects/api/members-api";
import { safeRemoveItem, safeSetItem } from "@/shared/lib/safe-storage";
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
    const [isLoadingInvite, setIsLoadingInvite] = useState(false);
    const [isActing, setIsActing] = useState(false);

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            setInvite(null);
            setLoadError(false);
            setIsLoadingInvite(false);
            return;
        }

        let cancelled = false;
        setIsLoadingInvite(true);
        void getInviteByToken(token)
            .then(({ data, error }) => {
                if (cancelled) return;
                const row = Array.isArray(data) ? data[0] : data;
                if (error || !row) {
                    setLoadError(true);
                    setInvite(null);
                } else {
                    setInvite(row as InvitePreview);
                    setLoadError(false);
                }
            })
            .catch(() => {
                if (cancelled) return;
                setLoadError(true);
                setInvite(null);
            })
            .finally(() => {
                if (!cancelled) setIsLoadingInvite(false);
            });
        return () => {
            cancelled = true;
        };
    }, [authLoading, token, user]);

    const onAccept = async () => {
        if (!invite || isActing) return;
        setIsActing(true);
        try {
            const { error } = await acceptInviteByToken(token);
            if (error) throw error;
            safeRemoveItem("sessionStorage", "plotops_pending_invite");
            toast.success(t("invite.acceptSuccess"));
            void navigate({ to: "/home" });
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
            const { data, error: previewError } = await getInviteByToken(token);
            if (!previewError) {
                const row = Array.isArray(data) ? data[0] : data;
                if (row) setInvite(row as InvitePreview);
            }
        } catch {
            toast.error(t("invite.claimFailed"));
        } finally {
            setIsActing(false);
        }
    };

    const goSignIn = () => {
        safeSetItem("sessionStorage", "plotops_pending_invite", token);
    };

    const goSignUp = () => {
        safeSetItem("sessionStorage", "plotops_pending_invite", token);
    };

    if (authLoading || (user && isLoadingInvite)) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center">
                <Spinner className="size-8 text-primary" />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-16">
                <header className="flex flex-col gap-1">
                    <p className="text-meta text-muted-foreground">
                        {t("invite.eyebrow")}
                    </p>
                    <h1 className="text-h1">{t("invite.signInTitle")}</h1>
                    <p className="text-ui text-muted-foreground">
                        {t("invite.createAccountFirst")}
                    </p>
                </header>
                <div className="flex flex-col gap-3">
                    <Button
                        nativeButton={false}
                        onClick={goSignUp}
                        render={<Link to="/sign-up" />}
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
                <h1 className="text-h1">{invite.team_name}</h1>
                <p className="text-ui text-muted-foreground">
                    {t("invite.asRole", {
                        role: t(`members.roles.${invite.role}`),
                    })}
                </p>
            </header>

            <div className="border border-border p-4 text-ui">
                <p>
                    {invite.email_matches
                        ? t("invite.forYourEmail", {
                              email: user.email ?? t("members.unknownUser"),
                          })
                        : t("invite.forOtherEmail")}
                </p>
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

            {invite.status === "pending" ? undefined : (
                <Alert>
                    <AlertDescription>
                        {t(`invite.status.${invite.status}`)}
                    </AlertDescription>
                </Alert>
            )}

            {invite.status === "pending" ? (
                <div className="flex flex-col gap-3">
                    <p className="text-ui text-muted-foreground">
                        {t("invite.signedInAs", {
                            email: user.email ?? t("members.unknownUser"),
                        })}
                    </p>
                    {invite.email_matches ? (
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
                    ) : invite.is_claimed ? (
                        <Alert>
                            <AlertDescription>
                                {invite.claimed_by_me
                                    ? t("invite.claimWaitingSelf")
                                    : t("invite.claimWaitingOther")}
                            </AlertDescription>
                        </Alert>
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
