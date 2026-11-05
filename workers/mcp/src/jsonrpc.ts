export type JsonRpcError = {
    error: {
        code: number;
        data?: unknown;
        message: string;
    };
    id: JsonRpcId;
    jsonrpc: "2.0";
};

export type JsonRpcId = null | number | string;

export type JsonRpcRequest = {
    id?: JsonRpcId;
    jsonrpc: "2.0";
    method: string;
    params?: unknown;
};

export type JsonRpcSuccess = {
    id: JsonRpcId;
    jsonrpc: "2.0";
    result: unknown;
};

export const PARSE_ERROR = -32_700;
export const INVALID_REQUEST = -32_600;
export const METHOD_NOT_FOUND = -32_601;
export const INVALID_PARAMS = -32_602;
export const INTERNAL_ERROR = -32_603;

export function errorResponse(
    id: JsonRpcId,
    code: number,
    message: string,
    data?: unknown
): JsonRpcError {
    return {
        error: data === undefined ? { code, message } : { code, data, message },
        id,
        jsonrpc: "2.0",
    };
}

export function isJsonRpcRequest(value: unknown): value is JsonRpcRequest {
    if (!value || typeof value !== "object") return false;
    const record = value as Record<string, unknown>;
    return record.jsonrpc === "2.0" && typeof record.method === "string";
}

export function parseJsonRpcBody(
    body: string
): JsonRpcRequest | JsonRpcRequest[] {
    const parsed: unknown = JSON.parse(body);
    if (Array.isArray(parsed)) {
        if (parsed.length === 0) {
            throw new SyntaxError("Empty JSON-RPC batch");
        }
        if (!parsed.every((item) => isJsonRpcRequest(item))) {
            throw new TypeError("Invalid JSON-RPC batch");
        }
        return parsed;
    }
    if (!isJsonRpcRequest(parsed)) {
        throw new TypeError("Invalid JSON-RPC request");
    }
    return parsed;
}

export function success(id: JsonRpcId, result: unknown): JsonRpcSuccess {
    return { id, jsonrpc: "2.0", result };
}
