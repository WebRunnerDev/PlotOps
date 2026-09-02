import { createFileRoute } from "@tanstack/react-router";

import { SignUpForm } from "@/features/auth";
import { AuthPageSeo } from "@/features/auth/ui/auth-page-seo";
import { AuthPageShell } from "@/widgets/auth-page-shell";

type SignUpSearch = {
    email?: string;
};

export const Route = createFileRoute("/(auth)/sign-up")({
    component: SignUpPage,
    validateSearch: (search: Record<string, unknown>): SignUpSearch => ({
        email: typeof search.email === "string" ? search.email : undefined,
    }),
});

function SignUpPage() {
    const { email } = Route.useSearch();

    return (
        <>
            <AuthPageSeo path="/sign-up" titleKey="signUpTitle" />
            <AuthPageShell>
                <SignUpForm initialEmail={email ?? ""} />
            </AuthPageShell>
        </>
    );
}
