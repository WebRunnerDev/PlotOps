import { createFileRoute } from "@tanstack/react-router";

import {
    LoginForm,
    signInRouteBeforeLoad,
    type SignInSearch,
} from "@/features/auth";
import { AuthPageSeo } from "@/features/auth/ui/auth-page-seo";
import { AuthPageShell } from "@/widgets/auth-page-shell";

export const Route = createFileRoute("/(auth)/sign-in")({
    beforeLoad: signInRouteBeforeLoad,
    component: SignInPage,
    validateSearch: (search: Record<string, unknown>): SignInSearch => ({
        redirect:
            typeof search.redirect === "string" ? search.redirect : undefined,
    }),
});

function SignInPage() {
    const { redirect: redirectTo } = Route.useSearch();

    return (
        <>
            <AuthPageSeo path="/sign-in" titleKey="signInTitle" />
            <AuthPageShell>
                <LoginForm redirectTo={redirectTo} />
            </AuthPageShell>
        </>
    );
}
