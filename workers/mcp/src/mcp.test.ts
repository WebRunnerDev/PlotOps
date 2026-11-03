import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { handleMcpPost } from "./mcp.ts";
import { TOOLS } from "./tools.ts";

const dirname = path.dirname(fileURLToPath(import.meta.url));

function fakeContext() {
    return {
        clientId: "client",
        supabase: {} as never,
        user: { id: "user-1" } as never,
    };
}

describe("MCP Streamable HTTP handler", () => {
    it("answers initialize and tools/list without a session", async () => {
        const init = await handleMcpPost(
            JSON.stringify({
                id: 1,
                jsonrpc: "2.0",
                method: "initialize",
                params: { protocolVersion: "2025-06-18" },
            }),
            fakeContext()
        );
        const initBody = (await init.json()) as {
            result: { protocolVersion: string; serverInfo: { name: string } };
        };
        expect(initBody.result.protocolVersion).toBe("2025-06-18");
        expect(initBody.result.serverInfo.name).toBe("plotops");

        const list = await handleMcpPost(
            JSON.stringify({
                id: 2,
                jsonrpc: "2.0",
                method: "tools/list",
            }),
            fakeContext()
        );
        const listBody = (await list.json()) as {
            result: { tools: Array<{ name: string }> };
        };
        expect(listBody.result.tools.map((tool) => tool.name)).toEqual(
            TOOLS.map((tool) => tool.name)
        );
    });

    it("returns 202 for notifications with no id", async () => {
        const response = await handleMcpPost(
            JSON.stringify({
                jsonrpc: "2.0",
                method: "notifications/initialized",
            }),
            fakeContext()
        );
        expect(response.status).toBe(202);
    });

    it("rejects an oversized body", async () => {
        const response = await handleMcpPost(
            "x".repeat(300_000),
            fakeContext()
        );
        expect(response.status).toBe(413);
    });
});

describe("MCP worker security seam", () => {
    it("never mentions the service role key", () => {
        const source = ["index.ts", "supabase.ts", "tools.ts", "oauth.ts"]
            .map((name) => readFileSync(path.join(dirname, name), "utf8"))
            .join("\n");

        expect(source).not.toMatch(/service[_-]?role/i);
        expect(source).toMatch(/SUPABASE_PUBLISHABLE_KEY/);
        expect(source).toMatch(/getUser/);
    });

    it("registers the initial PlotOps tool set", () => {
        expect(TOOLS.map((tool) => tool.name)).toEqual([
            "whoami",
            "list_projects",
            "list_boards",
            "list_tasks",
            "get_task",
            "create_task",
            "update_task",
            "change_status",
            "add_comment",
        ]);
        expect(TOOLS.some((tool) => tool.name.includes("delete"))).toBe(false);
    });
});
