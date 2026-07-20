/** Map a filename to a highlighter language id for @git-diff-view. */
export function langFromFilename(filename: string): string {
    const base = filename.split("/").pop() ?? filename;
    const lower = base.toLowerCase();

    if (lower === "dockerfile") return "docker";
    if (lower === "makefile") return "makefile";
    if (lower.endsWith(".d.ts")) return "typescript";

    const ext = lower.includes(".")
        ? (lower.split(".").pop() ?? "")
        : "";

    const map: Record<string, string> = {
        c: "c",
        cpp: "cpp",
        css: "css",
        go: "go",
        h: "c",
        hpp: "cpp",
        html: "html",
        java: "java",
        js: "javascript",
        json: "json",
        jsx: "jsx",
        kt: "kotlin",
        md: "markdown",
        mdx: "markdown",
        php: "php",
        py: "python",
        rb: "ruby",
        rs: "rust",
        scss: "scss",
        sh: "bash",
        sql: "sql",
        svg: "xml",
        toml: "toml",
        ts: "typescript",
        tsx: "tsx",
        vue: "vue",
        xml: "xml",
        yaml: "yaml",
        yml: "yaml",
    };

    return map[ext] ?? (ext || "plaintext");
}
