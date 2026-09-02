import { describe, expect, it } from "vitest";

import {
    deriveConnectedProviders,
    deriveSignInProviderSlots,
} from "@/features/auth/lib/connected-providers";

describe("deriveConnectedProviders", () => {
    it("lists Google, GitHub, and Email from identities in stable order", () => {
        expect(
            deriveConnectedProviders({
                app_metadata: {
                    provider: "google",
                    providers: ["google", "github", "email"],
                },
                email: "ada@example.com",
                identities: [
                    {
                        identity_data: { email: "ada@example.com" },
                        provider: "email",
                    },
                    {
                        identity_data: {
                            email: "ada@gmail.com",
                            user_name: "WebRunnerDev",
                        },
                        provider: "github",
                        provider_id: "12345",
                    },
                    {
                        identity_data: { email: "ada@gmail.com" },
                        provider: "google",
                    },
                ],
                user_metadata: {},
            } as never)
        ).toEqual([
            { identifier: "ada@gmail.com", provider: "google" },
            { identifier: "WebRunnerDev", provider: "github" },
            { identifier: "ada@example.com", provider: "email" },
        ]);
    });

    it("falls back to app_metadata.providers when identities are absent", () => {
        expect(
            deriveConnectedProviders({
                app_metadata: {
                    provider: "google",
                    providers: ["google", "email"],
                },
                email: "ada@example.com",
                user_metadata: {},
            } as never)
        ).toEqual([
            { identifier: "ada@example.com", provider: "google" },
            { identifier: "ada@example.com", provider: "email" },
        ]);
    });

    it("does not fall back to app_metadata when identities is empty after unlink", () => {
        expect(
            deriveConnectedProviders({
                app_metadata: {
                    provider: "google",
                    providers: ["google", "github"],
                },
                email: "ada@gmail.com",
                identities: [],
                user_metadata: {},
            } as never)
        ).toEqual([]);
    });

    it("uses GitHub login from identity metadata when GitHub is linked after Google", () => {
        expect(
            deriveConnectedProviders({
                app_metadata: {
                    provider: "google",
                    providers: ["google", "github"],
                },
                email: "ada@gmail.com",
                identities: [
                    {
                        identity_data: { email: "ada@gmail.com" },
                        provider: "google",
                    },
                    {
                        identity_data: { user_name: "plotops-dev" },
                        provider: "github",
                        provider_id: "999",
                    },
                ],
                user_metadata: { user_name: "google-handle" },
            } as never)
        ).toEqual([
            { identifier: "ada@gmail.com", provider: "google" },
            { identifier: "plotops-dev", provider: "github" },
        ]);
    });

    it("returns an empty list when no supported providers are linked", () => {
        expect(
            deriveConnectedProviders({
                app_metadata: { provider: "azure", providers: ["azure"] },
                email: "ada@example.com",
                identities: [],
                user_metadata: {},
            } as never)
        ).toEqual([]);
    });

    it("lists linkable providers and connected email in sign-in slots", () => {
        expect(
            deriveSignInProviderSlots({
                app_metadata: { provider: "email", providers: ["email"] },
                email: "ada@example.com",
                identities: [
                    {
                        identity_data: { email: "ada@example.com" },
                        identity_id: "email-id",
                        provider: "email",
                    },
                ],
                user_metadata: {},
            } as never)
        ).toEqual([
            {
                connected: false,
                identifier: "",
                identity: undefined,
                provider: "google",
            },
            {
                connected: false,
                identifier: "",
                identity: undefined,
                provider: "github",
            },
            {
                connected: true,
                identifier: "ada@example.com",
                identity: {
                    identity_data: { email: "ada@example.com" },
                    identity_id: "email-id",
                    provider: "email",
                },
                provider: "email",
            },
        ]);
    });
});
