import { createClient } from "@supabase/supabase-js";

import type { McpEnv as McpEnvironment } from "./env.ts";

/** Subset of the Supabase access-token claims the Worker reads. */
export type JwtClaims = {
    [claim: string]: unknown;
    email?: string;
    iss?: string;
    role?: string;
    sub?: string;
};

export type UserSupabase = {
    auth: {
        getClaims: (jwt: string) => Promise<{
            data: null | { claims: JwtClaims };
            error: null | { message: string };
        }>;
    };
    from: (table: string) => {
        select: (columns: string) => QueryBuilder;
    };
    rpc: (fn: string, args?: Record<string, unknown>) => QueryResult;
};

type QueryBuilder = QueryResult & {
    eq: (column: string, value: unknown) => QueryBuilder;
    in: (column: string, values: readonly unknown[]) => QueryBuilder;
    is: (column: string, value: unknown) => QueryBuilder;
    limit: (count: number) => QueryBuilder;
    or: (filter: string) => QueryBuilder;
    order: (column: string, options?: { ascending?: boolean }) => QueryBuilder;
    range: (from: number, to: number) => QueryBuilder;
    single: () => QueryResult;
};

type QueryResult = PromiseLike<{
    // PostgREST rows are untyped here so the Worker stays schema-agnostic.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- row shape varies per tool
    data: any;
    error: null | { message: string };
}>;

export function createUserClient(
    environment: McpEnvironment,
    accessToken: string
): UserSupabase {
    return createClient(
        environment.SUPABASE_URL,
        environment.SUPABASE_PUBLISHABLE_KEY,
        {
            auth: {
                autoRefreshToken: false,
                detectSessionInUrl: false,
                persistSession: false,
            },
            global: {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            },
        }
    ) as unknown as UserSupabase;
}
