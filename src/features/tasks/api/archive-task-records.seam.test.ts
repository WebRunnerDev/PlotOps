import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("TasksProvider archiveTaskRecords seam", () => {
    it("exposes bulk archive on the provider type and adapters", () => {
        const providerType = fs.readFileSync(
            path.join(dirname, "tasks-provider.ts"),
            "utf8"
        );
        const api = fs.readFileSync(path.join(dirname, "tasks-api.ts"), "utf8");
        const supabase = fs.readFileSync(
            path.join(dirname, "supabase-tasks.ts"),
            "utf8"
        );
        const guest = fs.readFileSync(
            path.join(dirname, "guest-tasks.ts"),
            "utf8"
        );

        expect(providerType).toMatch(/archiveTaskRecords\s*\(/);
        expect(api).toMatch(/archive_tasks/);
        expect(api).toMatch(/export async function archiveTaskRecords/);
        expect(supabase).toMatch(/archiveTaskRecords/);
        expect(guest).toMatch(/async archiveTaskRecords/);
    });
});
