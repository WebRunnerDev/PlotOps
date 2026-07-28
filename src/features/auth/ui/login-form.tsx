import { Link, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import {
    getAuthErrorKey,
    signInWithGitHub,
    signInWithPassword,
} from "@/features/auth/api/auth-api";
import { useAuth } from "@/features/auth/model/use-auth";
import { Alert, AlertDescription } from "@/shared/shadcn/ui/alert";
import { Button } from "@/shared/shadcn/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/shared/shadcn/ui/card";
import { Input } from "@/shared/shadcn/ui/input";
import { Label } from "@/shared/shadcn/ui/label";
import { Separator } from "@/shared/shadcn/ui/separator";

export function LoginForm() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { t } = useTranslation("auth");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<null | string>(null);
    const [isGitHubLoading, setIsGitHubLoading] = useState(false);
    const [isEmailLoading, setIsEmailLoading] = useState(false);
    // Wait for AuthProvider + router context before navigating — otherwise
    // /home beforeLoad still sees user=null and bounces back to /sign-in.
    const [awaitingRedirect, setAwaitingRedirect] = useState(false);

    useEffect(() => {
        if (!awaitingRedirect || !user) return;

        const pendingInvite = globalThis.sessionStorage.getItem(
            "plotops_pending_invite"
        );
        if (pendingInvite) {
            globalThis.sessionStorage.removeItem("plotops_pending_invite");
            void navigate({
                params: { token: pendingInvite },
                to: "/invite/$token",
            });
            return;
        }

        void navigate({ to: "/home" });
    }, [awaitingRedirect, navigate, user]);

    const handleGitHubLogin = async () => {
        setError(null);
        setIsGitHubLoading(true);

        const { error: authError } = await signInWithGitHub();

        setIsGitHubLoading(false);
        if (authError) setError(t(getAuthErrorKey(authError)));
    };

    const handleEmailLogin = async (event: FormEvent) => {
        event.preventDefault();
        setError(null);
        setIsEmailLoading(true);

        const { error: authError } = await signInWithPassword({
            email,
            password,
        });

        if (authError) {
            setIsEmailLoading(false);
            setError(t(getAuthErrorKey(authError)));
            return;
        }

        setAwaitingRedirect(true);
    };

    return (
        <Card className="mx-auto w-full max-w-sm">
            <CardHeader className="text-center">
                <CardTitle>{t("signInTitle")}</CardTitle>
                <CardDescription>{t("signInSubtitle")}</CardDescription>
            </CardHeader>

            <CardContent className="flex flex-col gap-6">
                {error ? (
                    <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                ) : undefined}

                <Button
                    className="w-full"
                    disabled={isGitHubLoading || isEmailLoading}
                    onClick={handleGitHubLogin}
                    type="button"
                    variant="outline"
                >
                    {isGitHubLoading
                        ? t("githubRedirecting")
                        : t("githubSignIn")}
                </Button>

                <div className="flex items-center gap-3">
                    <Separator className="flex-1" />
                    <span className="text-meta text-muted-foreground">
                        {t("or")}
                    </span>
                    <Separator className="flex-1" />
                </div>

                <form
                    className="flex flex-col gap-4"
                    onSubmit={handleEmailLogin}
                >
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="email">{t("email")}</Label>
                        <Input
                            autoComplete="email"
                            id="email"
                            onChange={(event) => setEmail(event.target.value)}
                            placeholder={t("emailPlaceholder")}
                            required
                            type="email"
                            value={email}
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label htmlFor="password">{t("password")}</Label>
                        <Input
                            autoComplete="current-password"
                            id="password"
                            onChange={(event) =>
                                setPassword(event.target.value)
                            }
                            placeholder={t("passwordPlaceholder")}
                            required
                            type="password"
                            value={password}
                        />
                    </div>

                    <Button
                        className="w-full"
                        disabled={isGitHubLoading || isEmailLoading}
                        type="submit"
                    >
                        {isEmailLoading ? t("signInLoading") : t("signIn")}
                    </Button>
                </form>

                <p className="text-center text-meta text-muted-foreground">
                    {t("links.noAccount")}{" "}
                    <Link
                        className="underline underline-offset-2"
                        to="/sign-up"
                    >
                        {t("links.signUp")}
                    </Link>
                </p>
            </CardContent>
        </Card>
    );
}
