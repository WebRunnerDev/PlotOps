import { createFileRoute } from "@tanstack/react-router";

import {
    LoginForm,
    signInRouteBeforeLoad,
    type SignInSearch,
} from "@/features/auth";
import { AuthPageSeo } from "@/features/auth/ui/auth-page-seo";
import { AuthPageShell } from "@/widgets/auth-page-shell";

export const Route = createFileRoute("/")({
    beforeLoad: signInRouteBeforeLoad,
    component: LandingPage,
    validateSearch: (search: Record<string, unknown>): SignInSearch => ({
        redirect:
            typeof search.redirect === "string" ? search.redirect : undefined,
    }),
});

function LandingPage() {
    const { redirect: redirectTo } = Route.useSearch();

    return (
        <>
            <AuthPageSeo path="/" titleKey="signInTitle" />
            <AuthPageShell>
                <LoginForm redirectTo={redirectTo} />
            </AuthPageShell>
        </>
    );
}
