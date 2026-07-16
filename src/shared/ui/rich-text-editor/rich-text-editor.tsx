import {
    autoUpdate,
    computePosition,
    flip,
    offset,
    shift,
} from "@floating-ui/dom";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import FileHandler from "@tiptap/extension-file-handler";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { common, createLowlight } from "lowlight";
import {
    Bold,
    Check,
    Code2,
    Highlighter,
    Italic,
    Link2,
    Strikethrough,
    Underline as UnderlineIcon,
} from "lucide-react";
import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type DragEvent,
    type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import {
    normalizeEditorContent,
    toEditorContent,
} from "@/shared/ui/rich-text-editor/content";
import {
    ImageUpload,
    filterImageFiles,
    insertImageFiles,
    type ImageUploadFn,
} from "@/shared/ui/rich-text-editor/image-upload";
import {
    deleteSlashQuery,
    filterSlashCommands,
    type SlashCommand,
} from "@/shared/ui/rich-text-editor/slash-commands";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/shadcn/ui/button";
import "@/shared/ui/rich-text-editor/rich-text-editor.css";

const lowlight = createLowlight(common);

type RichTextEditorProperties = {
    className?: string;
    id?: string;
    onBlur?: () => void;
    onChange?: (value: string) => void;
    onUploadImage?: ImageUploadFn;
    placeholder?: string;
    value: string;
};

type ReferenceRect = {
    bottom: number;
    left: number;
    right: number;
    top: number;
};

type FloatingMenuState = {
    activeIds: string[];
    activeIndex: number;
    commands: SlashCommand[];
    query: string;
    reference: ReferenceRect | null;
    source: "context" | "slash" | null;
};

const EMPTY_MENU: FloatingMenuState = {
    activeIds: [],
    activeIndex: 0,
    commands: [],
    query: "",
    reference: null,
    source: null,
};

function toReferenceRect(rect: {
    bottom: number;
    left: number;
    right?: number;
    top: number;
}): ReferenceRect {
    return {
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right ?? rect.left,
        top: rect.top,
    };
}

function createVirtualElement(rect: ReferenceRect) {
    return {
        getBoundingClientRect: () => ({
            bottom: rect.bottom,
            height: Math.max(rect.bottom - rect.top, 1),
            left: rect.left,
            right: rect.right,
            top: rect.top,
            width: Math.max(rect.right - rect.left, 1),
            x: rect.left,
            y: rect.top,
        }),
    };
}

function getSlashQuery(editor: Editor) {
    const { $from } = editor.state.selection;
    const textBefore = $from.parent.textBetween(
        0,
        $from.parentOffset,
        undefined,
        "\uFFFC",
    );
    const match = /(?:^|\s)\/([a-z0-9-]*)$/i.exec(textBefore);
    if (!match) return undefined;

    return {
        query: match[1] ?? "",
        rect: toReferenceRect(editor.view.coordsAtPos($from.pos)),
    };
}

function getSelectionRect(editor: Editor) {
    const { from, to, empty } = editor.state.selection;
    if (empty || from === to) return undefined;

    const start = editor.view.coordsAtPos(from);
    const end = editor.view.coordsAtPos(to);

    return toReferenceRect({
        bottom: Math.max(start.bottom, end.bottom),
        left: Math.min(start.left, end.left),
        right: Math.max(start.right, end.right),
        top: Math.min(start.top, end.top),
    });
}

function isCommandActive(editor: Editor, commandId: SlashCommand["id"]) {
    switch (commandId) {
        case "paragraph": {
            // Plain text block — not when a list / heading / code is the primary type.
            return (
                editor.isActive("paragraph") &&
                !editor.isActive("heading") &&
                !editor.isActive("bulletList") &&
                !editor.isActive("orderedList") &&
                !editor.isActive("taskList") &&
                !editor.isActive("codeBlock")
            );
        }
        case "heading-1": {
            return editor.isActive("heading", { level: 1 });
        }
        case "heading-2": {
            return editor.isActive("heading", { level: 2 });
        }
        case "heading-3": {
            return editor.isActive("heading", { level: 3 });
        }
        case "bullet-list": {
            return editor.isActive("bulletList");
        }
        case "ordered-list": {
            return editor.isActive("orderedList");
        }
        case "task-list": {
            return editor.isActive("taskList");
        }
        case "quote": {
            return editor.isActive("blockquote");
        }
        case "code-block": {
            return editor.isActive("codeBlock");
        }
        case "divider": {
            return editor.isActive("horizontalRule");
        }
        default: {
            return false;
        }
    }
}

function buildMenuState(
    editor: Editor,
    source: "context" | "slash",
    reference: ReferenceRect,
    query = "",
): FloatingMenuState {
    const commands = filterSlashCommands(query);
    const activeIds = commands
        .filter((command) => isCommandActive(editor, command.id))
        .map((command) => command.id);
    const activeIndex = Math.max(
        commands.findIndex((command) => activeIds.includes(command.id)),
        0,
    );

    return {
        activeIds,
        activeIndex,
        commands,
        query,
        reference,
        source,
    };
}

function resolveSlashMenu(editor: Editor): FloatingMenuState | undefined {
    const slash = getSlashQuery(editor);
    if (!slash) return undefined;

    return buildMenuState(editor, "slash", slash.rect, slash.query);
}

function ToolbarButton({
    active,
    ariaLabel,
    children,
    onClick,
}: {
    active?: boolean;
    ariaLabel: string;
    children: ReactNode;
    onClick: () => void;
}) {
    return (
        <Button
            aria-label={ariaLabel}
            className={cn(active && "bg-muted text-foreground")}
            onClick={onClick}
            size="icon-xs"
            type="button"
            variant="ghost"
        >
            {children}
        </Button>
    );
}

export function RichTextEditor({
    className,
    id,
    onBlur,
    onChange,
    onUploadImage,
    placeholder,
    value,
}: RichTextEditorProperties) {
    const { t } = useTranslation("board");
    const [menu, setMenu] = useState<FloatingMenuState>(EMPTY_MENU);
    const [isDraggingFile, setIsDraggingFile] = useState(false);
    const menuRef = useRef<HTMLDivElement | null>(null);
    const editorRef = useRef<Editor | null>(null);
    const dragDepthRef = useRef(0);
    const menuStateRef = useRef(menu);
    menuStateRef.current = menu;

    const reportUploadError = useCallback(
        (error: unknown) => {
            const code =
                error instanceof Error ? error.message : "uploadFailed";
            const known = [
                "unsupportedType",
                "tooLarge",
                "unauthenticated",
                "uploadUnavailable",
            ] as const;
            const key = known.includes(code as (typeof known)[number])
                ? code
                : "uploadFailed";
            toast.error(t(`richText.media.${key}`));
        },
        [t],
    );

    const editorAttributes = useMemo(() => {
        const attributes: Record<string, string> = {
            class: cn(
                "min-h-40 w-full max-w-full overflow-x-hidden break-words px-1 py-1 text-sm leading-7 outline-none [overflow-wrap:anywhere]",
                "focus:outline-none",
            ),
        };

        if (id) {
            attributes.id = id;
            attributes["aria-labelledby"] = `${id}-label`;
        }

        return attributes;
    }, [id]);

    const closeMenu = useCallback(() => {
        setMenu(EMPTY_MENU);
    }, []);

    const editor = useEditor({
        content: toEditorContent(value),
        editorProps: {
            attributes: editorAttributes,
            handleDOMEvents: {
                contextmenu: (_view, event) => {
                    const currentEditor = editorRef.current;
                    if (!currentEditor || currentEditor.state.selection.empty) {
                        return false;
                    }

                    event.preventDefault();

                    const selectionRect = getSelectionRect(currentEditor);
                    const reference =
                        selectionRect ??
                        toReferenceRect({
                            bottom: event.clientY,
                            left: event.clientX,
                            right: event.clientX,
                            top: event.clientY,
                        });

                    setMenu(
                        buildMenuState(currentEditor, "context", reference),
                    );
                    return true;
                },
                mousedown: (_view, event) => {
                    if (!menuStateRef.current.commands.length) return false;
                    if (event.button === 2) return false;

                    const target = event.target;
                    if (
                        target instanceof Node &&
                        menuRef.current?.contains(target)
                    ) {
                        return false;
                    }

                    closeMenu();
                    return false;
                },
            },
            handleKeyDown: (_view, event) => {
                const current = menuStateRef.current;
                if (!current.commands.length) return false;

                if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setMenu((state) => ({
                        ...state,
                        activeIndex:
                            (state.activeIndex + 1) % state.commands.length,
                    }));
                    return true;
                }

                if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setMenu((state) => ({
                        ...state,
                        activeIndex:
                            (state.activeIndex - 1 + state.commands.length) %
                            state.commands.length,
                    }));
                    return true;
                }

                if (event.key === "Escape") {
                    event.preventDefault();
                    closeMenu();
                    return true;
                }

                if (event.key === "Enter") {
                    event.preventDefault();
                    const command = current.commands[current.activeIndex];
                    const currentEditor = editorRef.current;
                    if (command && currentEditor) {
                        if (current.source === "slash") {
                            deleteSlashQuery(currentEditor, current.query);
                        }
                        command.run(currentEditor);
                        closeMenu();
                    }
                    return true;
                }

                return false;
            },
        },
        extensions: [
            StarterKit.configure({
                codeBlock: false,
            }),
            CodeBlockLowlight.configure({
                lowlight,
            }),
            Highlight,
            Link.configure({
                autolink: true,
                defaultProtocol: "https",
                openOnClick: false,
            }),
            Placeholder.configure({
                placeholder:
                    placeholder ?? t("fields.descriptionPlaceholder"),
            }),
            TaskItem.configure({
                HTMLAttributes: {
                    class: "task-item",
                },
                nested: true,
            }),
            TaskList,
            TextAlign.configure({
                types: ["heading", "paragraph"],
            }),
            Underline,
            Image.configure({
                allowBase64: false,
                HTMLAttributes: {
                    class: "rich-text-image",
                },
            }),
            ImageUpload,
            FileHandler.configure({
                // Don't filter by MIME here — Windows drag often has an empty type.
                // Filtering happens in insertImageFiles / isImageFile.
                consumePasteEvent: true,
                onDrop: (currentEditor, files, position) => {
                    void insertImageFiles(currentEditor, files, position);
                },
                onPaste: (currentEditor, files) => {
                    void insertImageFiles(currentEditor, files);
                },
            }),
        ],
        immediatelyRender: false,
        onBlur: () => {
            onBlur?.();
        },
        onSelectionUpdate: ({ editor: currentEditor }) => {
            const current = menuStateRef.current;

            if (current.source === "slash") {
                setMenu(resolveSlashMenu(currentEditor) ?? EMPTY_MENU);
                return;
            }

            if (
                current.source === "context" &&
                currentEditor.state.selection.empty
            ) {
                closeMenu();
            }
        },
        onUpdate: ({ editor: currentEditor }) => {
            const next = normalizeEditorContent(currentEditor.getHTML());
            onChange?.(next);

            const slashMenu = resolveSlashMenu(currentEditor);
            if (slashMenu) {
                setMenu(slashMenu);
                return;
            }

            if (menuStateRef.current.source === "slash") {
                closeMenu();
            }
        },
    });

    useEffect(() => {
        editorRef.current = editor;
    }, [editor]);

    useEffect(() => {
        if (!editor) return;
        editor.storage.imageUpload.upload = onUploadImage;
        editor.storage.imageUpload.onError = reportUploadError;
    }, [editor, onUploadImage, reportUploadError]);

    useLayoutEffect(() => {
        const menuElement = menuRef.current;
        const reference = menu.reference;
        if (!menuElement || !reference || menu.commands.length === 0) return;

        const virtualElement = createVirtualElement(reference);

        return autoUpdate(virtualElement, menuElement, () => {
            void computePosition(virtualElement, menuElement, {
                middleware: [
                    offset(8),
                    flip({
                        fallbackPlacements: [
                            "bottom-start",
                            "top-end",
                            "bottom-end",
                        ],
                    }),
                    shift({ padding: 8 }),
                ],
                placement: "top-start",
                strategy: "fixed",
            }).then(({ x, y }) => {
                menuElement.style.left = `${x}px`;
                menuElement.style.top = `${y}px`;
            });
        });
    }, [menu.commands.length, menu.reference]);

    const toolbarState = useEditorState({
        editor,
        selector: ({ editor: currentEditor }) => {
            if (!currentEditor) {
                return {
                    isBold: false,
                    isCode: false,
                    isHighlight: false,
                    isItalic: false,
                    isLink: false,
                    isStrike: false,
                    isUnderline: false,
                };
            }

            return {
                isBold: currentEditor.isActive("bold"),
                isCode: currentEditor.isActive("code"),
                isHighlight: currentEditor.isActive("highlight"),
                isItalic: currentEditor.isActive("italic"),
                isLink: currentEditor.isActive("link"),
                isStrike: currentEditor.isActive("strike"),
                isUnderline: currentEditor.isActive("underline"),
            };
        },
    });

    const editorContent = useMemo(() => toEditorContent(value), [value]);

    useEffect(() => {
        if (!editor) return;

        const current = normalizeEditorContent(editor.getHTML());
        if (current === editorContent) return;

        editor.commands.setContent(editorContent, { emitUpdate: false });
    }, [editor, editorContent]);

    const runSlashCommand = (command: SlashCommand) => {
        if (!editor) return;

        if (menu.source === "slash") {
            deleteSlashQuery(editor, menu.query);
        }
        command.run(editor);
        closeMenu();
    };

    const handleSetLink = () => {
        if (!editor) return;

        const previousUrl = editor.getAttributes("link").href as
            | string
            | undefined;
        const nextUrl = globalThis.prompt(
            t("richText.linkPrompt"),
            previousUrl ?? "https://",
        );

        if (nextUrl === null) return;

        const trimmed = nextUrl.trim();
        if (!trimmed) {
            editor.chain().focus().extendMarkRange("link").unsetLink().run();
            return;
        }

        editor
            .chain()
            .focus()
            .extendMarkRange("link")
            .setLink({ href: trimmed })
            .run();
    };

    const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        dragDepthRef.current += 1;
        setIsDraggingFile(true);
    };

    const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
    };

    const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
        if (dragDepthRef.current === 0) {
            setIsDraggingFile(false);
        }
    };

    const handleFileDrop = (event: DragEvent<HTMLDivElement>) => {
        if (!event.dataTransfer.types.includes("Files")) return;

        const files = filterImageFiles(event.dataTransfer.files);
        dragDepthRef.current = 0;
        setIsDraggingFile(false);

        if (!editor || files.length === 0) return;

        // Fallback when the drop lands on padding/chrome outside ProseMirror.
        // Drops on the editor surface are handled by FileHandler (stopPropagation).
        event.preventDefault();
        event.stopPropagation();
        void insertImageFiles(editor, files);
    };

    if (!editor) return null;

    const floatingMenu =
        menu.commands.length > 0 && menu.reference
            ? createPortal(
                  <div
                      className="fixed top-0 left-0 z-70 w-72 rounded-lg border border-border bg-popover p-1 shadow-md ring-1 ring-foreground/10"
                      ref={menuRef}
                  >
                      <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-1 pb-1">
                          <ToolbarButton
                              active={toolbarState?.isBold}
                              ariaLabel={t("richText.toolbar.bold")}
                              onClick={() =>
                                  editor.chain().focus().toggleBold().run()
                              }
                          >
                              <Bold />
                          </ToolbarButton>
                          <ToolbarButton
                              active={toolbarState?.isItalic}
                              ariaLabel={t("richText.toolbar.italic")}
                              onClick={() =>
                                  editor.chain().focus().toggleItalic().run()
                              }
                          >
                              <Italic />
                          </ToolbarButton>
                          <ToolbarButton
                              active={toolbarState?.isUnderline}
                              ariaLabel={t("richText.toolbar.underline")}
                              onClick={() =>
                                  editor
                                      .chain()
                                      .focus()
                                      .toggleUnderline()
                                      .run()
                              }
                          >
                              <UnderlineIcon />
                          </ToolbarButton>
                          <ToolbarButton
                              active={toolbarState?.isStrike}
                              ariaLabel={t("richText.toolbar.strike")}
                              onClick={() =>
                                  editor.chain().focus().toggleStrike().run()
                              }
                          >
                              <Strikethrough />
                          </ToolbarButton>
                          <ToolbarButton
                              active={toolbarState?.isCode}
                              ariaLabel={t("richText.toolbar.code")}
                              onClick={() =>
                                  editor.chain().focus().toggleCode().run()
                              }
                          >
                              <Code2 />
                          </ToolbarButton>
                          <ToolbarButton
                              active={toolbarState?.isHighlight}
                              ariaLabel={t("richText.toolbar.highlight")}
                              onClick={() =>
                                  editor
                                      .chain()
                                      .focus()
                                      .toggleHighlight()
                                      .run()
                              }
                          >
                              <Highlighter />
                          </ToolbarButton>
                          <ToolbarButton
                              active={toolbarState?.isLink}
                              ariaLabel={t("richText.toolbar.link")}
                              onClick={handleSetLink}
                          >
                              <Link2 />
                          </ToolbarButton>
                      </div>
                      <p className="px-2 py-1 text-xs text-muted-foreground">
                          {t("richText.slash.title")}
                      </p>
                      {menu.commands.map((command, index) => {
                          const Icon = command.icon;
                          const isApplied = menu.activeIds.includes(command.id);
                          const isFocused = index === menu.activeIndex;
                          return (
                              <button
                                  className={cn(
                                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                                      "hover:bg-muted",
                                      isApplied && "bg-muted/70 text-foreground",
                                      isFocused &&
                                          "bg-muted text-foreground ring-1 ring-ring/40",
                                  )}
                                  key={command.id}
                                  onMouseDown={(event) => {
                                      event.preventDefault();
                                      runSlashCommand(command);
                                  }}
                                  type="button"
                              >
                                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                                  <span className="flex-1">
                                      {t(command.titleKey)}
                                  </span>
                                  {isApplied ? (
                                      <Check
                                          aria-hidden
                                          className="size-3.5 shrink-0 text-foreground"
                                      />
                                  ) : null}
                              </button>
                          );
                      })}
                  </div>,
                  document.body,
              )
            : null;

    return (
        <div
            className={cn(
                "group/rich-text relative min-w-0 max-w-full overflow-hidden rounded-lg border border-transparent bg-transparent transition-colors",
                "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
                "dark:bg-input/20",
                isDraggingFile &&
                    "border-dashed border-primary bg-primary/5 ring-3 ring-primary/30",
                className,
            )}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleFileDrop}
        >
            {floatingMenu}

            {isDraggingFile ? (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                    <p className="rounded-md bg-background/90 px-3 py-1.5 text-sm text-foreground ring-1 ring-foreground/10">
                        {t("richText.media.dropHint")}
                    </p>
                </div>
            ) : null}

            <EditorContent
                className={cn(
                    "rich-text-editor block min-w-0 max-w-full overflow-hidden",
                    "[&_.ProseMirror]:min-h-40 [&_.ProseMirror]:w-full [&_.ProseMirror]:max-w-full [&_.ProseMirror]:overflow-x-hidden [&_.ProseMirror]:break-words [&_.ProseMirror]:outline-none [&_.ProseMirror]:[overflow-wrap:anywhere]",
                    "[&_.ProseMirror_*]:max-w-full",
                    "[&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none",
                    "[&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left",
                    "[&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0",
                    "[&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground",
                    "[&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
                    "[&_.ProseMirror_h1]:text-2xl [&_.ProseMirror_h1]:font-semibold",
                    "[&_.ProseMirror_h2]:text-xl [&_.ProseMirror_h2]:font-semibold",
                    "[&_.ProseMirror_h3]:text-lg [&_.ProseMirror_h3]:font-semibold",
                    "[&_.ProseMirror_ul]:my-2 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-6",
                    "[&_.ProseMirror_ol]:my-2 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-6",
                    "[&_.ProseMirror_blockquote]:my-2 [&_.ProseMirror_blockquote]:border-l-2 [&_.ProseMirror_blockquote]:border-border [&_.ProseMirror_blockquote]:pl-4 [&_.ProseMirror_blockquote]:text-muted-foreground",
                    "[&_.ProseMirror_pre]:my-2 [&_.ProseMirror_pre]:max-w-full [&_.ProseMirror_pre]:overflow-x-auto [&_.ProseMirror_pre]:rounded-md [&_.ProseMirror_pre]:bg-muted [&_.ProseMirror_pre]:p-3 [&_.ProseMirror_pre]:font-mono [&_.ProseMirror_pre]:text-xs",
                    "[&_.ProseMirror_code]:break-all [&_.ProseMirror_code]:rounded [&_.ProseMirror_code]:bg-muted [&_.ProseMirror_code]:px-1 [&_.ProseMirror_code]:py-0.5 [&_.ProseMirror_code]:font-mono [&_.ProseMirror_code]:text-code",
                    "[&_.ProseMirror_a]:break-all [&_.ProseMirror_a]:text-primary [&_.ProseMirror_a]:underline [&_.ProseMirror_a]:underline-offset-4",
                    "[&_.ProseMirror_hr]:my-4 [&_.ProseMirror_hr]:border-border",
                    "[&_.ProseMirror_mark]:rounded-sm [&_.ProseMirror_mark]:bg-amber-200/70 [&_.ProseMirror_mark]:px-0.5 [&_.ProseMirror_mark]:text-foreground",
                    "dark:[&_.ProseMirror_mark]:bg-amber-400/25",
                )}
                editor={editor}
            />
        </div>
    );
}
