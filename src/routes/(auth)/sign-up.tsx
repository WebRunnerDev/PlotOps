import { createFileRoute } from "@tanstack/react-router";

import { SignUpForm } from "@/features/auth";

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
        <div className="flex min-h-[60vh] items-center justify-center px-4">
            <SignUpForm initialEmail={email ?? ""} />
        </div>
    );
}
