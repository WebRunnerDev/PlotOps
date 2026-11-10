import type { ToolContext } from "./tools.ts";

import {
    errorResponse,
    INVALID_PARAMS,
    INVALID_REQUEST,
    type JsonRpcId,
    type JsonRpcRequest,
    METHOD_NOT_FOUND,
    PARSE_ERROR,
    parseJsonRpcBody,
    success,
} from "./jsonrpc.ts";
import { MAX_MCP_BODY_BYTES, utf8ByteLength } from "./limits.ts";
import {
    callTool,
    RICH_TEXT_FORMAT_HINT,
    ToolInputError,
    toolListPayload,
} from "./tools.ts";

const PROTOCOL_VERSION = "2025-06-18";
const SUPPORTED_PROTOCOLS = new Set(["2024-11-05", "2025-03-26", "2025-06-18"]);

export const SERVER_INSTRUCTIONS = [
    "PlotOps project tracker. Use list_projects, then list_boards and list_tasks. Status is a board column id (see list_boards). You act as the signed-in user; RLS applies.",
    "To assign work, find people with list_members and pass their user_id as assignee_id.",
    "Model structure with fields, never with text in the description: epic_id (list_epics), parent_id for Parent Task / Subtask, and link_tasks for blocks / relates_to. get_task returns these relations.",
    `Task descriptions and comments: ${RICH_TEXT_FORMAT_HINT}`,
].join("\n");

export function acceptsMcp(request: Request): boolean {
    const accept = request.headers.get("Accept") ?? "";
    if (!accept) return true;
    return (
        accept.includes("application/json") ||
        accept.includes("text/event-stream") ||
        accept.includes("*/*")
    );
}

export async function handleMcpPost(
    body: string,
    context: ToolContext
): Promise<Response> {
    if (utf8ByteLength(body) > MAX_MCP_BODY_BYTES) {
        return Response.json(
            { error: "payload_too_large" },
            {
                headers: { "Content-Type": "application/json" },
                status: 413,
            }
        );
    }

    let parsed: JsonRpcRequest | JsonRpcRequest[];
    try {
        parsed = parseJsonRpcBody(body);
    } catch (error) {
        const isParse = error instanceof SyntaxError;
        return Response.json(
            errorResponse(
                null,
                isParse ? PARSE_ERROR : INVALID_REQUEST,
                isParse ? "Parse error" : "Invalid request"
            )
        );
    }

    const batch = Array.isArray(parsed) ? parsed : [parsed];
    const responses = [];
    for (const item of batch) {
        const response = await handleRequest(item, context);
        if (response) responses.push(response);
    }

    if (responses.length === 0) {
        return new Response(null, { status: 202 });
    }

    const payload = Array.isArray(parsed) ? responses : responses[0];
    return Response.json(payload);
}

async function handleRequest(request: JsonRpcRequest, context: ToolContext) {
    const id: JsonRpcId = request.id ?? null;
    const isNotification = request.id === undefined;

    try {
        switch (request.method) {
            case "initialize": {
                const parameters = recordParameters(request.params);
                return success(id, {
                    capabilities: { tools: { listChanged: false } },
                    instructions: SERVER_INSTRUCTIONS,
                    protocolVersion: protocolVersion(
                        parameters.protocolVersion
                    ),
                    serverInfo: { name: "plotops", version: "1.0.0" },
                });
            }
            case "notifications/cancelled":
            case "notifications/initialized":
            case "ping": {
                if (isNotification || request.method !== "ping") {
                    return null;
                }
                return success(id, {});
            }
            case "tools/call": {
                const parameters = recordParameters(request.params);
                const name = parameters.name;
                if (typeof name !== "string" || name.length === 0) {
                    return errorResponse(
                        id,
                        INVALID_PARAMS,
                        "tools/call requires name"
                    );
                }
                const result = await callTool(
                    name,
                    parameters.arguments,
                    context
                );
                return success(id, {
                    content: [{ text: result.text, type: "text" }],
                    isError: result.isError === true,
                });
            }
            case "tools/list": {
                return success(id, toolListPayload());
            }
            default: {
                return errorResponse(
                    id,
                    METHOD_NOT_FOUND,
                    `Method not found: ${request.method}`
                );
            }
        }
    } catch (error) {
        if (error instanceof ToolInputError) {
            return errorResponse(id, INVALID_PARAMS, error.message);
        }
        const message =
            error instanceof Error ? error.message : "Internal error";
        return success(id, {
            content: [{ text: message, type: "text" }],
            isError: true,
        });
    }
}

function protocolVersion(requested: unknown): string {
    if (typeof requested === "string" && SUPPORTED_PROTOCOLS.has(requested)) {
        return requested;
    }
    return PROTOCOL_VERSION;
}

function recordParameters(parameters: unknown): Record<string, unknown> {
    if (
        !parameters ||
        typeof parameters !== "object" ||
        Array.isArray(parameters)
    ) {
        return {};
    }
    return parameters as Record<string, unknown>;
}
