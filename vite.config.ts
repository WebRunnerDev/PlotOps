import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
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
