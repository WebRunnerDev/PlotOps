import { Link, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";

import {
    getAuthErrorKey,
    resendSignupConfirmation,
    signUpWithPassword,
} from "@/features/auth/api/auth-api";
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

type SignUpFormProperties = {
    initialEmail?: string;
};

export function SignUpForm({ initialEmail = "" }: SignUpFormProperties) {
    const navigate = useNavigate();
    const { t } = useTranslation("auth");
    const [email, setEmail] = useState(initialEmail);
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState<null | string>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isResending, setIsResending] = useState(false);
    const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
    const [resendMessage, setResendMessage] = useState<null | string>(null);

    const handleSignUp = async (event: FormEvent) => {
        event.preventDefault();
        setError(null);
        setResendMessage(null);

        if (password !== confirmPassword) {
            setError(t("errors.passwordMismatch"));
            return;
        }

        if (password.length < 6) {
            setError(t("errors.weakPassword"));
            return;
        }

        setIsLoading(true);

        const { data, error: authError } = await signUpWithPassword({
            email,
            password,
        });

        setIsLoading(false);

        if (authError) {
            setError(t(getAuthErrorKey(authError)));
            return;
        }

        // With confirmations on, an existing email may return a user with no identities.
        if (data.user && (data.user.identities?.length ?? 0) === 0) {
            setError(t("errors.userAlreadyRegistered"));
            return;
        }

        // Confirm-email ON: no session until the link is clicked.
        if (!data.session) {
            setAwaitingConfirmation(true);
            return;
        }

        const pendingInvite =
            globalThis.sessionStorage.getItem("plotops_pending_invite");
        if (pendingInvite) {
            globalThis.sessionStorage.removeItem("plotops_pending_invite");
            navigate({
                params: { token: pendingInvite },
                to: "/invite/$token",
            });
            return;
        }

        navigate({ to: "/home" });
    };

    const handleResend = async () => {
        setError(null);
        setResendMessage(null);
        setIsResending(true);

        const { error: resendError } = await resendSignupConfirmation(email);

        setIsResending(false);

        if (resendError) {
            setError(t(getAuthErrorKey(resendError)));
            return;
        }

        setResendMessage(t("checkEmail.resent"));
    };

    if (awaitingConfirmation) {
        return (
            <Card className="mx-auto w-full max-w-sm">
                <CardHeader className="text-center">
                    <CardTitle>{t("checkEmail.title")}</CardTitle>
                    <CardDescription>
                        {t("checkEmail.description", { email })}
                    </CardDescription>
                </CardHeader>

                <CardContent className="flex flex-col gap-4">
                    {error ? (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    ) : undefined}

                    {resendMessage ? (
                        <Alert>
                            <AlertDescription>{resendMessage}</AlertDescription>
                        </Alert>
                    ) : undefined}

                    <Button
                        className="w-full"
                        disabled={isResending}
                        onClick={() => void handleResend()}
                        type="button"
                        variant="outline"
                    >
                        {isResending
                            ? t("checkEmail.resendLoading")
                            : t("checkEmail.resend")}
                    </Button>

                    <p className="text-center text-meta text-muted-foreground">
                        <Link className="underline underline-offset-2" to="/sign-in">
                            {t("links.backToSignIn")}
                        </Link>
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="mx-auto w-full max-w-sm">
            <CardHeader className="text-center">
                <CardTitle>{t("signUpTitle")}</CardTitle>
                <CardDescription>{t("signUpSubtitle")}</CardDescription>
            </CardHeader>

            <CardContent className="flex flex-col gap-6">
                {error ? (
                    <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                ) : undefined}

                <form className="flex flex-col gap-4" onSubmit={handleSignUp}>
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="sign-up-email">{t("email")}</Label>
                        <Input
                            autoComplete="email"
                            id="sign-up-email"
                            onChange={(event) => setEmail(event.target.value)}
                            placeholder={t("emailPlaceholder")}
                            required
                            type="email"
                            value={email}
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label htmlFor="sign-up-password">{t("password")}</Label>
                        <Input
                            autoComplete="new-password"
                            id="sign-up-password"
                            onChange={(event) =>
                                setPassword(event.target.value)
                            }
                            placeholder={t("passwordPlaceholder")}
                            required
                            type="password"
                            value={password}
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label htmlFor="sign-up-confirm">
                            {t("confirmPassword")}
                        </Label>
                        <Input
                            autoComplete="new-password"
                            id="sign-up-confirm"
                            onChange={(event) =>
                                setConfirmPassword(event.target.value)
                            }
                            placeholder={t("passwordPlaceholder")}
                            required
                            type="password"
                            value={confirmPassword}
                        />
                    </div>

                    <Button
                        className="w-full"
                        disabled={isLoading}
                        type="submit"
                    >
                        {isLoading ? t("signUpLoading") : t("signUp")}
                    </Button>
                </form>

                <p className="text-center text-meta text-muted-foreground">
                    {t("links.hasAccount")}{" "}
                    <Link className="underline underline-offset-2" to="/sign-in">
                        {t("links.signIn")}
                    </Link>
                </p>
            </CardContent>
        </Card>
    );
}
