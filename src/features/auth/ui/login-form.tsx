import { useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
    signInWithGitHub,
    signInWithPassword,
} from "@/features/auth/api/auth-api";
import { Button } from "@/shared/shadcn/ui/button";

export function LoginForm() {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isGitHubLoading, setIsGitHubLoading] = useState(false);
    const [isEmailLoading, setIsEmailLoading] = useState(false);

    const handleGitHubLogin = async () => {
        setError(null);
        setIsGitHubLoading(true);

        const { error: authError } = await signInWithGitHub();

        setIsGitHubLoading(false);
        if (authError) setError(authError.message);
    };

    const handleEmailLogin = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsEmailLoading(true);

        const { error: authError } = await signInWithPassword({
            email,
            password,
        });

        setIsEmailLoading(false);

        if (authError) {
            setError(authError.message);
            return;
        }

        navigate({ to: "/home" });
    };

    return (
        <div className="mx-auto w-full max-w-sm space-y-6">
            <div className="space-y-1 text-center">
                <h1 className="text-2xl font-semibold tracking-tight">
                    Войти в PlotOps
                </h1>
                <p className="text-sm text-muted-foreground">
                    Войдите через GitHub или email и пароль
                </p>
            </div>

            {error && (
                <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                </p>
            )}

            <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleGitHubLogin}
                disabled={isGitHubLoading || isEmailLoading}
            >
                {isGitHubLoading ? "Перенаправление..." : "Войти через GitHub"}
            </Button>

            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                        или
                    </span>
                </div>
            </div>

            <form onSubmit={handleEmailLogin} className="space-y-4">
                <div className="space-y-2">
                    <label htmlFor="email" className="text-sm font-medium">
                        Email
                    </label>
                    <input
                        id="email"
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                </div>

                <div className="space-y-2">
                    <label htmlFor="password" className="text-sm font-medium">
                        Пароль
                    </label>
                    <input
                        id="password"
                        type="password"
                        autoComplete="current-password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                </div>

                <Button
                    type="submit"
                    className="w-full"
                    disabled={isGitHubLoading || isEmailLoading}
                >
                    {isEmailLoading ? "Вход..." : "Войти"}
                </Button>
            </form>
        </div>
    );
}
