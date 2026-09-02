import { createFileRoute } from "@tanstack/react-router";

import { LoginForm, signInRouteBeforeLoad } from "@/features/auth";
import { AuthPageSeo } from "@/features/auth/ui/auth-page-seo";
import { AuthPageShell } from "@/widgets/auth-page-shell";

export const Route = createFileRoute("/(auth)/sign-in")({
    beforeLoad: signInRouteBeforeLoad,
    component: SignInPage,
});

function SignInPage() {
    return (
        <>
            <AuthPageSeo path="/sign-in" titleKey="signInTitle" />
            <AuthPageShell>
                <LoginForm />
            </AuthPageShell>
        </>
    );
}
