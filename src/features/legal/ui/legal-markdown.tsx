import type { Components } from "react-markdown";

import { Link } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/shared/lib/utils";

const legalMarkdownComponents: Components = {
    a: ({ children, href }) => {
        if (href?.startsWith("/")) {
            return (
                <Link
                    className="text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    to={href}
                >
                    {children}
                </Link>
            );
        }

        return (
            <a
                className="text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                href={href}
                rel="noreferrer"
                target="_blank"
            >
                {children}
            </a>
        );
    },
    blockquote: ({ children }) => (
        <blockquote className="border-border text-muted-foreground border-l-2 pl-4 italic">
            {children}
        </blockquote>
    ),
    h1: ({ children }) => (
        <h1 className="text-h1 mb-4 wrap-break-word">{children}</h1>
    ),
    h2: ({ children }) => (
        <h2 className="text-h2 mt-8 mb-3 wrap-break-word">{children}</h2>
    ),
    h3: ({ children }) => (
        <h3 className="mt-6 mb-2 text-lg font-semibold wrap-break-word">
            {children}
        </h3>
    ),
    hr: () => <hr className="border-border my-8" />,
    li: ({ children }) => (
        <li className="text-body leading-relaxed">{children}</li>
    ),
    ol: ({ children }) => (
        <ol className="text-body my-3 list-decimal space-y-1 ps-6">
            {children}
        </ol>
    ),
    p: ({ children }) => (
        <p className="text-body text-muted-foreground my-3 leading-relaxed wrap-break-word">
            {children}
        </p>
    ),
    strong: ({ children }) => (
        <strong className="text-foreground font-semibold">{children}</strong>
    ),
    table: ({ children }) => (
        <div className="my-4 w-full min-w-0 overflow-x-auto">
            <table className="border-border w-full min-w-0 border text-sm">
                {children}
            </table>
        </div>
    ),
    tbody: ({ children }) => <tbody>{children}</tbody>,
    td: ({ children }) => (
        <td className="border-border text-body border px-3 py-2 align-top wrap-break-word">
            {children}
        </td>
    ),
    th: ({ children }) => (
        <th className="border-border bg-muted/40 border px-3 py-2 text-left font-semibold wrap-break-word">
            {children}
        </th>
    ),
    thead: ({ children }) => <thead>{children}</thead>,
    tr: ({ children }) => <tr>{children}</tr>,
    ul: ({ children }) => (
        <ul className="text-body my-3 list-disc space-y-1 ps-6">{children}</ul>
    ),
};

type LegalMarkdownProperties = {
    className?: string;
    source: string;
};

export function LegalMarkdown({ className, source }: LegalMarkdownProperties) {
    return (
        <article className={cn("min-w-0 w-full break-words", className)}>
            <ReactMarkdown
                components={legalMarkdownComponents}
                remarkPlugins={[remarkGfm]}
            >
                {source}
            </ReactMarkdown>
        </article>
    );
}
