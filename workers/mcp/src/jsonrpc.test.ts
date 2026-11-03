import { describe, expect, it } from "vitest";

import {
    errorResponse,
    isJsonRpcRequest,
    parseJsonRpcBody,
    success,
} from "./jsonrpc.ts";

describe("jsonrpc", () => {
    it("parses a single JSON-RPC request", () => {
        const parsed = parseJsonRpcBody(
            JSON.stringify({
                id: 1,
                jsonrpc: "2.0",
                method: "tools/list",
            })
        );
        expect(parsed).toMatchObject({ method: "tools/list" });
        expect(Array.isArray(parsed)).toBe(false);
    });

    it("parses a batch", () => {
        const parsed = parseJsonRpcBody(
            JSON.stringify([
                { id: 1, jsonrpc: "2.0", method: "ping" },
                { jsonrpc: "2.0", method: "notifications/initialized" },
            ])
        );
        expect(Array.isArray(parsed)).toBe(true);
        expect(parsed).toHaveLength(2);
    });

    it("rejects non JSON-RPC payloads", () => {
        expect(() => parseJsonRpcBody("{}")).toThrow(TypeError);
        expect(() => parseJsonRpcBody("not-json")).toThrow(SyntaxError);
        expect(() => parseJsonRpcBody("[]")).toThrow(SyntaxError);
    });

    it("builds success and error envelopes", () => {
        expect(success(1, { ok: true })).toEqual({
            id: 1,
            jsonrpc: "2.0",
            result: { ok: true },
        });
        expect(errorResponse(1, -32_601, "missing")).toMatchObject({
            error: { code: -32_601, message: "missing" },
            id: 1,
        });
        expect(isJsonRpcRequest({ jsonrpc: "2.0", method: "ping" })).toBe(true);
        expect(isJsonRpcRequest({ method: "ping" })).toBe(false);
    });
});
