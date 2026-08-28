import { z } from "zod";

import type { Database } from "@/shared/api/database.types";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export const userProfileSchema = z.object({
    avatar_url: z.string().nullable(),
    first_name: z.string().nullable(),
    github_id: z.number().nullable(),
    github_login: z.string().nullable(),
    id: z.string(),
    last_name: z.string().nullable(),
    username: z.string().nullable(),
}) satisfies z.ZodType<
    Pick<
        ProfileRow,
        | "avatar_url"
        | "first_name"
        | "github_id"
        | "github_login"
        | "id"
        | "last_name"
        | "username"
    >
>;

export type UserProfile = z.infer<typeof userProfileSchema>;

export const profileNameRowSchema = z.object({
    first_name: z.string().nullable(),
    github_id: z.number().nullable(),
    github_login: z.string().nullable(),
    id: z.string(),
    last_name: z.string().nullable(),
    username: z.string().nullable(),
}) satisfies z.ZodType<
    Pick<
        ProfileRow,
        | "first_name"
        | "github_id"
        | "github_login"
        | "id"
        | "last_name"
        | "username"
    >
>;

export type ProfileNameRow = z.infer<typeof profileNameRowSchema>;

export function parseProfileNameRow(data: unknown): ProfileNameRow {
    return profileNameRowSchema.parse(data);
}

export function parseUserProfile(data: unknown): UserProfile {
    return userProfileSchema.parse(data);
}

export function parseUserProfileOrNull(data: unknown): null | UserProfile {
    if (data == undefined) return null;
    return parseUserProfile(data);
}
