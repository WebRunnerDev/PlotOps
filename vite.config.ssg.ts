import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

/** SSR bundle for build-time SSG of public routes. */
export default defineConfig({
    build: {
        emptyOutDir: true,
        outDir: "dist-ssr",
        rollupOptions: {
            output: {
                entryFileNames: "render-route.js",
            },
        },
        ssr: "src/app/ssg/render-route.tsx",
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
    ],
    resolve: {
        alias: {
            "@": path.resolve(import.meta.dirname, "./src"),
        },
    },
    ssr: {
        noExternal: ["react-i18next", "i18next"],
    },
});
