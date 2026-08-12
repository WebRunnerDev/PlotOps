export type NotFoundCta = {
    labelKey: "notFound.goHome" | "notFound.goSignIn";
    to: "/home" | "/sign-in";
};

/** Primary CTA: Home for signed-in / guest; sign-in when logged out. */
export function resolveNotFoundCta(hasMainAppAccess: boolean): NotFoundCta {
    if (hasMainAppAccess) {
        return { labelKey: "notFound.goHome", to: "/home" };
    }
    return { labelKey: "notFound.goSignIn", to: "/sign-in" };
}
