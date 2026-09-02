import type { User, UserIdentity } from "@supabase/supabase-js";

import { githubIdentityFromUser } from "@/features/auth/lib/resolve-github-profile-fields";

export type AuthSignInProvider = "email" | "github" | "google";

export type ConnectedProviderRow = {
    identifier: string;
    provider: AuthSignInProvider;
};

export type SignInProviderSlot = {
    connected: boolean;
    identifier: string;
    identity?: UserIdentity;
    provider: AuthSignInProvider;
};

const PROVIDER_ORDER: AuthSignInProvider[] = ["google", "github", "email"];
const LINKABLE_PROVIDERS = new Set<AuthSignInProvider>(["github", "google"]);

/** Read-only connected sign-in methods for Settings (ADR 0026, #225). */
export function deriveConnectedProviders(user: User): ConnectedProviderRow[] {
    const providers = collectLinkedProviders(user);

    return PROVIDER_ORDER.filter((provider) => providers.has(provider)).map(
        (provider) => ({
            identifier: resolveProviderIdentifier(user, provider),
            provider,
        })
    );
}

/** Connected + linkable provider rows for Settings connect/disconnect (#226). */
export function deriveSignInProviderSlots(user: User): SignInProviderSlot[] {
    const connectedRows = deriveConnectedProviders(user);
    const connectedByProvider = new Map(
        connectedRows.map((row) => [row.provider, row])
    );

    return PROVIDER_ORDER.filter(
        (provider) =>
            LINKABLE_PROVIDERS.has(provider) ||
            connectedByProvider.has(provider)
    ).map((provider) => {
        const connectedRow = connectedByProvider.get(provider);
        const identity = findIdentityForProvider(user, provider);

        return {
            connected: Boolean(connectedRow),
            identifier: connectedRow?.identifier ?? "",
            identity,
            provider,
        };
    });
}

function collectLinkedProviders(user: User): Set<AuthSignInProvider> {
    const providers = new Set<AuthSignInProvider>();

    // Prefer identities whenever the array is present — even empty after unlink.
    // app_metadata.providers can lag behind; do not treat it as source of truth.
    if (user.identities != undefined) {
        for (const identity of user.identities) {
            const normalized = normalizeProvider(identity.provider);
            if (normalized) providers.add(normalized);
        }
        return providers;
    }

    for (const provider of user.app_metadata?.providers ?? []) {
        const normalized = normalizeProvider(provider);
        if (normalized) providers.add(normalized);
    }

    const primary = normalizeProvider(user.app_metadata?.provider);
    if (primary) providers.add(primary);

    return providers;
}

function findIdentityForProvider(
    user: User,
    provider: AuthSignInProvider
): undefined | UserIdentity {
    return user.identities?.find(
        (row) => normalizeProvider(row.provider) === provider
    );
}

function normalizeProvider(
    provider: string | undefined
): AuthSignInProvider | null {
    if (
        provider === "google" ||
        provider === "github" ||
        provider === "email"
    ) {
        return provider;
    }
    return null;
}

function readEmailFromIdentityData(
    data: Record<string, unknown> | undefined
): string {
    if (!data) return "";

    const email = data.email;
    if (typeof email !== "string") return "";

    return email.trim();
}

function resolveProviderIdentifier(
    user: User,
    provider: AuthSignInProvider
): string {
    const identity = user.identities?.find(
        (row) => normalizeProvider(row.provider) === provider
    );

    if (provider === "github") {
        const login = githubIdentityFromUser(user).github_login;
        if (login) return login;
    }

    const identityEmail = readEmailFromIdentityData(identity?.identity_data);
    if (identityEmail) return identityEmail;

    if (provider !== "github" && user.email) {
        return user.email;
    }

    return "";
}
