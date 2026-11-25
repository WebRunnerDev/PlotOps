import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

import { securityHeaders } from "./config/vite-security-headers.ts";

// https://vite.dev/config/
export default defineConfig({
    // Pages sets CF_PAGES_BRANCH at build time; previews show a "production
    // data" banner (src/shared/config/deploy-environment.ts).
    define: {
        "import.meta.env.VITE_DEPLOY_BRANCH": JSON.stringify(
            process.env.CF_PAGES_BRANCH ?? ""
        ),
    },
    plugins: [
        tanstackRouter({
            autoCodeSplitting: true,
            generatedRouteTree: "./src/app/routeTree.gen.ts",
            routeFileIgnorePattern: String.raw`\.(test|spec)\.(ts|tsx)$`,
            routesDirectory: "./src/routes",
            target: "react",
        }),
        react(),
        tailwindcss(),
        securityHeaders(),
    ],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    // Bind IPv4 so OAuth redirects to http://127.0.0.1:5173 work on Windows
    // (default Vite may listen only on ::1 / localhost).
    server: {
        host: "127.0.0.1",
        port: 5173,
    },
});
