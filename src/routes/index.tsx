import { createFileRoute } from "@tanstack/react-router";

import { LoginForm, signInRouteBeforeLoad } from "@/features/auth";
import { AuthPageSeo } from "@/features/auth/ui/auth-page-seo";
import { AuthPageShell } from "@/widgets/auth-page-shell";

export const Route = createFileRoute("/")({
    beforeLoad: signInRouteBeforeLoad,
    component: LandingPage,
});

function LandingPage() {
    return (
        <>
            <AuthPageSeo path="/" titleKey="signInTitle" />
            <AuthPageShell>
                <LoginForm />
            </AuthPageShell>
        </>
    );
}
