import type { Json } from "@/shared/api/database.types";

export type { Database, Json } from "@/shared/api/database.types";

/** Assert app values as Supabase `Json` for RPC / jsonb columns. */
export function asJson(value: unknown): Json {
    return value as Json;
}
