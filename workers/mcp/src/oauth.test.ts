import { describe, expect, it } from "vitest";

import {
    authorizationServerUrl,
    bearerToken,
    isMcpPath,
    isProtectedResourceMetadataPath,
    mcpResourceUrl,
    protectedResourceMetadata,
    readJwtClientId,
    unauthorizedResponse,
} from "./oauth.ts";

describe("oauth helpers", () => {
    const environment = {
        SUPABASE_PUBLISHABLE_KEY: "key",
        SUPABASE_URL: "https://ijcelrdcygzyzhcijkhe.supabase.co",
    };

    it("derives the Auth issuer from the project URL", () => {
        expect(authorizationServerUrl(environment)).toBe(
            "https://ijcelrdcygzyzhcijkhe.supabase.co/auth/v1"
        );
    });

    it("advertises /mcp as the resource unless overridden", () => {
        const request = new Request("https://plotops-mcp.example/mcp");
        expect(mcpResourceUrl(request, environment)).toBe(
            "https://plotops-mcp.example/mcp"
        );
        expect(
            mcpResourceUrl(request, {
                ...environment,
                MCP_RESOURCE_URL: "https://mcp.plotops.webrunner.dev/mcp/",
            })
        ).toBe("https://mcp.plotops.webrunner.dev/mcp");
    });

    it("recognizes protected-resource metadata paths", () => {
        expect(
            isProtectedResourceMetadataPath(
                "/.well-known/oauth-protected-resource"
            )
        ).toBe(true);
        expect(isProtectedResourceMetadataPath("/mcp")).toBe(false);
        expect(isMcpPath("/mcp")).toBe(true);
        expect(isMcpPath("/mcp/")).toBe(true);
    });

    it("lists Supabase Auth as the authorization server", () => {
        const request = new Request("https://plotops-mcp.example/mcp");
        expect(protectedResourceMetadata(request, environment)).toEqual({
            authorization_servers: [
                "https://ijcelrdcygzyzhcijkhe.supabase.co/auth/v1",
            ],
            bearer_methods_supported: ["header"],
            resource: "https://plotops-mcp.example/mcp",
            scopes_supported: ["openid", "email", "profile"],
        });
    });

    it("reads a Bearer token and optional client_id claim", () => {
        const request = new Request("https://example/mcp", {
            headers: { Authorization: "Bearer tok_abc" },
        });
        expect(bearerToken(request)).toBe("tok_abc");
        expect(bearerToken(new Request("https://example/mcp"))).toBeNull();

        const payload = btoa(JSON.stringify({ client_id: "mcp-client" }));
        expect(readJwtClientId(`aaa.${payload}.sig`)).toBe("mcp-client");
        expect(readJwtClientId("not-a-jwt")).toBeNull();
    });
});

describe("unauthorizedResponse", () => {
    it("advertises resource_metadata per RFC 9728", () => {
        const response = unauthorizedResponse(
            new Request("https://mcp.example.dev/mcp", { method: "POST" }),
            {
                SUPABASE_PUBLISHABLE_KEY: "key",
                SUPABASE_URL: "https://ijcelrdcygzyzhcijkhe.supabase.co",
            }
        );
        expect(response.status).toBe(401);
        expect(response.headers.get("WWW-Authenticate")).toBe(
            'Bearer resource_metadata="https://mcp.example.dev/.well-known/oauth-protected-resource", resource="https://mcp.example.dev/mcp"'
        );
    });
});
