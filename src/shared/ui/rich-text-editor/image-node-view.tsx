import { type NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import {
    AlignCenter,
    AlignLeft,
    AlignRight,
    Copy,
    Maximize2,
    Square,
    SquareDashed,
} from "lucide-react";
import {
    type PointerEvent as ReactPointerEvent,
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { cn } from "@/shared/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@/shared/shadcn/ui/dialog";
import { Spinner } from "@/shared/shadcn/ui/spinner";
import { copyImageSourceToClipboard } from "@/shared/ui/rich-text-editor/copy-image";
import { shouldShowImageChrome } from "@/shared/ui/rich-text-editor/image-chrome";

const MIN_WIDTH = 48;
const TOOLBAR_EDGE_PAD = 8;

type Alignment = "center" | "left" | "right";

const ALIGNMENTS: { icon: typeof AlignLeft; value: Alignment }[] = [
    { icon: AlignLeft, value: "left" },
    { icon: AlignCenter, value: "center" },
    { icon: AlignRight, value: "right" },
];

type Corner = "ne" | "nw" | "se" | "sw";

const CORNERS: { className: string; corner: Corner; signX: number }[] = [
    {
        className:
            "left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize",
        corner: "nw",
        signX: -1,
    },
    {
        className:
            "right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize",
        corner: "ne",
        signX: 1,
    },
    {
        className:
            "left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize",
        corner: "sw",
        signX: -1,
    },
    {
        className:
            "right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize",
        corner: "se",
        signX: 1,
    },
];

export function ImageNodeView({
    editor,
    getPos,
    node,
    selected,
    updateAttributes,
}: NodeViewProps) {
    const { t } = useTranslation("board");
    const imageReference = useRef<HTMLImageElement | null>(null);
    const frameReference = useRef<HTMLSpanElement | null>(null);
    const toolbarReference = useRef<HTMLSpanElement | null>(null);
    const wrapperReference = useRef<HTMLDivElement | null>(null);
    const topSentinelReference = useRef<HTMLSpanElement | null>(null);
    const bottomSentinelReference = useRef<HTMLSpanElement | null>(null);
    const aspectReference = useRef<null | number>(null);
    const [isResizing, setIsResizing] = useState(false);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [editorFocused, setEditorFocused] = useState(() => editor.isFocused);
    const [toolbarInteracting, setToolbarInteracting] = useState(false);
    const [toolbarPlacement, setToolbarPlacement] = useState<
        "bottom" | "hidden" | "top"
    >("top");
    const [widthField, setWidthField] = useState("");
    const [heightField, setHeightField] = useState("");

    const source = node.attrs.src as string;
    const alt = (node.attrs.alt as null | string) ?? "";
    const width = node.attrs.width as null | number;
    const height = node.attrs.height as null | number;
    const bordered = Boolean(node.attrs.bordered);
    const align = (node.attrs.align as Alignment | null) ?? "left";
    const uploading = Boolean(node.attrs.uploading);
    const isEditable = editor.isEditable;
    // Boot/`setContent` can leave a NodeSelection on a leading image without the
    // editor being focused (task drawer open). Width/height inputs also blur the
    // editor — keep chrome while those fields hold focus.
    const isActivelySelected = shouldShowImageChrome({
        editorFocused,
        selected,
        toolbarInteracting,
        uploading: false,
    });
    const showControls = isEditable && isActivelySelected && !uploading;
    const showCopyControl = isActivelySelected && !uploading && Boolean(source);

    useEffect(() => {
        const handleFocus = () => setEditorFocused(true);
        const handleBlur = () => setEditorFocused(false);
        editor.on("focus", handleFocus);
        editor.on("blur", handleBlur);
        setEditorFocused(editor.isFocused);
        return () => {
            editor.off("focus", handleFocus);
            editor.off("blur", handleBlur);
        };
    }, [editor]);

    useEffect(() => {
        if (!selected) setToolbarInteracting(false);
    }, [selected]);

    const getAspectRatio = useCallback(() => {
        if (aspectReference.current) return aspectReference.current;
        if (width && height) return width / height;
        const image = imageReference.current;
        if (image?.naturalWidth && image.naturalHeight) {
            return image.naturalWidth / image.naturalHeight;
        }
        return null;
    }, [height, width]);

    const getMaxWidth = useCallback(() => {
        const surface = wrapperReference.current?.closest(".ProseMirror");
        return surface instanceof HTMLElement ? surface.clientWidth : 0;
    }, []);

    const syncFields = useCallback(() => {
        const image = imageReference.current;
        const measuredWidth = image
            ? Math.round(image.getBoundingClientRect().width)
            : 0;
        const measuredHeight = image
            ? Math.round(image.getBoundingClientRect().height)
            : 0;
        const nextWidth = width ?? measuredWidth;
        const nextHeight = height ?? measuredHeight;
        setWidthField(nextWidth > 0 ? String(nextWidth) : "");
        setHeightField(nextHeight > 0 ? String(nextHeight) : "");
    }, [height, width]);

    const handleImageLoad = useCallback(() => {
        const image = imageReference.current;
        if (image?.naturalWidth && image.naturalHeight) {
            aspectReference.current = image.naturalWidth / image.naturalHeight;
        }
        syncFields();
    }, [syncFields]);

    const startResize = useCallback(
        (event: ReactPointerEvent, signX: number) => {
            event.preventDefault();
            event.stopPropagation();

            const image = imageReference.current;
            if (!image) return;

            const startX = event.clientX;
            const startWidth = image.getBoundingClientRect().width;
            const aspect = getAspectRatio();
            const maxWidth = getMaxWidth();

            setIsResizing(true);

            const handleMove = (moveEvent: PointerEvent) => {
                const delta = (moveEvent.clientX - startX) * signX;
                const nextWidth = clampWidth(startWidth + delta, maxWidth);
                const nextHeight = aspect
                    ? Math.round(nextWidth / aspect)
                    : null;
                updateAttributes({ height: nextHeight, width: nextWidth });
            };

            const handleUp = () => {
                setIsResizing(false);
                globalThis.removeEventListener("pointermove", handleMove);
                globalThis.removeEventListener("pointerup", handleUp);
            };

            globalThis.addEventListener("pointermove", handleMove);
            globalThis.addEventListener("pointerup", handleUp);
        },
        [getAspectRatio, getMaxWidth, updateAttributes]
    );

    const applyWidth = useCallback(
        (value: number) => {
            if (!Number.isFinite(value) || value <= 0) return;
            const nextWidth = clampWidth(value, getMaxWidth());
            const aspect = getAspectRatio();
            updateAttributes({
                height: aspect ? Math.round(nextWidth / aspect) : null,
                width: nextWidth,
            });
        },
        [getAspectRatio, getMaxWidth, updateAttributes]
    );

    const applyHeight = useCallback(
        (value: number) => {
            if (!Number.isFinite(value) || value <= 0) return;
            const targetHeight = Math.max(1, Math.round(value));
            const aspect = getAspectRatio();
            if (!aspect) {
                updateAttributes({ height: targetHeight, width: null });
                return;
            }
            // Derive width from height, then clamp width and re-derive height so
            // the pair stays within the editor bounds without breaking ratio.
            const clampedWidth = clampWidth(
                targetHeight * aspect,
                getMaxWidth()
            );
            updateAttributes({
                height: Math.round(clampedWidth / aspect),
                width: clampedWidth,
            });
        },
        [getAspectRatio, getMaxWidth, updateAttributes]
    );

    const toggleBorder = useCallback(() => {
        updateAttributes({ bordered: !bordered });
    }, [bordered, updateAttributes]);

    const setAlignment = useCallback(
        (value: Alignment) => {
            updateAttributes({ align: value });
        },
        [updateAttributes]
    );

    const handleCopyImage = useCallback(() => {
        if (!source) return;
        void copyImageSourceToClipboard(source).then((result) => {
            if (result === "failed") {
                toast.error(t("copyFailed"));
                return;
            }
            toast.success(t("richText.media.copied"));
        });
    }, [source, t]);

    const openPreview = useCallback(() => {
        if (!source || uploading) return;
        setPreviewOpen(true);
    }, [source, uploading]);

    // The image node is `user-select: none` (so a text selection dragged across
    // it isn't painted over it). A side effect is that clicking the image no
    // longer clears an active text selection, so ProseMirror's default
    // click-to-select-node fails and the resize toolbar never appears.
    //
    // Capture-phase listener on the frame (not a React onMouseDown): React
    // delegates to the root and would fire after ProseMirror's handler on
    // `.ProseMirror`, which then clobbers NodeSelection on mouseup. Capture +
    // stopPropagation selects the node before PM sees the event.
    useEffect(() => {
        const frame = frameReference.current;
        if (!frame) return;

        const handleMouseDown = (event: MouseEvent) => {
            if (event.button !== 0) return;
            const target = event.target;
            if (!(target instanceof Element)) return;
            // Let resize handles / toolbar inputs keep their own pointer behavior.
            if (
                target.closest(
                    ".rich-text-image-handle, .rich-text-image-toolbar"
                )
            ) {
                return;
            }
            const pos = typeof getPos === "function" ? getPos() : null;
            if (typeof pos !== "number") return;
            event.preventDefault();
            event.stopPropagation();
            editor.chain().focus().setNodeSelection(pos).run();
        };

        frame.addEventListener("mousedown", handleMouseDown, true);
        return () =>
            frame.removeEventListener("mousedown", handleMouseDown, true);
    }, [editor, getPos]);

    useEffect(() => {
        if (width && height) {
            aspectReference.current = width / height;
        }
    }, [height, width]);

    useEffect(() => {
        syncFields();
    }, [syncFields]);

    // One observer (only while the image is selected) watching two thin probes
    // at the top and bottom of the image. Prefer the top; if it is clipped by
    // the scroll container, drop to the bottom; if neither fits, hide.
    useEffect(() => {
        if (!showCopyControl) return;
        const image = imageReference.current;
        const topProbe = topSentinelReference.current;
        const bottomProbe = bottomSentinelReference.current;
        if (!image || !topProbe || !bottomProbe) return;

        const fits = { bottom: false, top: true };

        // intersectionRect already accounts for clipping by every scrolling /
        // overflow ancestor (editor, drawer, viewport), so a probe is "fully
        // visible" when its clipped height still matches its own height.
        const isFullyVisible = (entry: IntersectionObserverEntry) =>
            entry.intersectionRect.height >=
            entry.boundingClientRect.height - 1;

        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.target === topProbe) {
                        fits.top = isFullyVisible(entry);
                    } else if (entry.target === bottomProbe) {
                        fits.bottom = isFullyVisible(entry);
                    }
                }
                setToolbarPlacement(
                    fits.top ? "top" : fits.bottom ? "bottom" : "hidden"
                );
            },
            { threshold: [0, 1] }
        );
        observer.observe(topProbe);
        observer.observe(bottomProbe);

        return () => observer.disconnect();
    }, [showCopyControl]);

    // Keep the floating image toolbar inside the editor's overflow box. The
    // shell uses overflow-x-hidden, so a left:8px toolbar on a right-aligned
    // (or narrow) image otherwise clips off the far edge — and the reverse when
    // left-aligned if we naively mirror with right:8px.
    useLayoutEffect(() => {
        if (!showCopyControl) return;
        const toolbar = toolbarReference.current;
        const frame = frameReference.current;
        const surface = wrapperReference.current?.closest(".ProseMirror");
        if (
            !(toolbar instanceof HTMLElement) ||
            !(frame instanceof HTMLElement) ||
            !(surface instanceof HTMLElement)
        ) {
            return;
        }

        const place = () => {
            toolbar.style.left = `${TOOLBAR_EDGE_PAD}px`;
            toolbar.style.right = "auto";
            toolbar.style.maxWidth = "";

            const surfaceRect = surface.getBoundingClientRect();
            const frameRect = frame.getBoundingClientRect();
            const available = Math.max(
                0,
                surfaceRect.width - TOOLBAR_EDGE_PAD * 2
            );
            if (available > 0) {
                toolbar.style.maxWidth = `${available}px`;
            }

            const toolbarWidth = toolbar.offsetWidth;
            const minLeft =
                surfaceRect.left + TOOLBAR_EDGE_PAD - frameRect.left;
            const maxLeft =
                surfaceRect.right -
                TOOLBAR_EDGE_PAD -
                toolbarWidth -
                frameRect.left;
            const nextLeft = Math.min(
                Math.max(TOOLBAR_EDGE_PAD, minLeft),
                Math.max(minLeft, maxLeft)
            );
            toolbar.style.left = `${nextLeft}px`;
        };

        place();

        const observer = new ResizeObserver(place);
        observer.observe(surface);
        observer.observe(frame);
        observer.observe(toolbar);
        return () => observer.disconnect();
    }, [align, showCopyControl, toolbarPlacement, width, widthField]);

    return (
        <NodeViewWrapper
            as="div"
            className="rich-text-image-view"
            contentEditable={false}
            data-align={align}
            data-selected={isActivelySelected ? "true" : undefined}
            ref={wrapperReference}
            style={{ textAlign: align }}
        >
            <span
                className={cn(
                    "rich-text-image-frame",
                    isActivelySelected && "is-selected",
                    isResizing && "is-resizing"
                )}
                onDoubleClick={(event) => {
                    // Resize handles / toolbar own their clicks; the bitmap
                    // (and empty frame chrome) open a full-size preview.
                    const target = event.target;
                    if (!(target instanceof Element)) return;
                    if (
                        target.closest(
                            ".rich-text-image-handle, .rich-text-image-toolbar"
                        )
                    ) {
                        return;
                    }
                    event.preventDefault();
                    openPreview();
                }}
                ref={frameReference}
                style={width ? { width: `${width}px` } : undefined}
            >
                <img
                    alt={alt}
                    className="rich-text-image"
                    data-bordered={bordered ? "true" : undefined}
                    draggable={false}
                    height={height ?? undefined}
                    onLoad={handleImageLoad}
                    ref={imageReference}
                    src={source}
                    title={
                        source && !uploading
                            ? t("richText.media.openHint")
                            : undefined
                    }
                    width={width ?? undefined}
                />

                {uploading ? (
                    <span className="rich-text-image-loader">
                        <Spinner className="size-6 text-white" />
                    </span>
                ) : null}

                {showCopyControl ? (
                    <>
                        <span
                            aria-hidden
                            className="rich-text-image-sentinel is-top"
                            ref={topSentinelReference}
                        />
                        <span
                            aria-hidden
                            className="rich-text-image-sentinel is-bottom"
                            ref={bottomSentinelReference}
                        />
                        {showControls
                            ? CORNERS.map(({ className, corner, signX }) => (
                                  <span
                                      className={cn(
                                          "rich-text-image-handle",
                                          className
                                      )}
                                      key={corner}
                                      onPointerDown={(event) =>
                                          startResize(event, signX)
                                      }
                                  />
                              ))
                            : null}

                        <span
                            className={cn(
                                "rich-text-image-toolbar",
                                toolbarPlacement === "bottom" && "is-bottom",
                                toolbarPlacement === "hidden" && "is-hidden"
                            )}
                            contentEditable={false}
                            onBlur={(event) => {
                                const next = event.relatedTarget;
                                if (
                                    next instanceof Node &&
                                    event.currentTarget.contains(next)
                                ) {
                                    return;
                                }
                                setToolbarInteracting(false);
                            }}
                            onDoubleClick={(event) => {
                                // Don't let field text-select double-clicks
                                // bubble to the frame's openPreview handler.
                                event.stopPropagation();
                            }}
                            onFocus={() => setToolbarInteracting(true)}
                            onMouseDown={() => setToolbarInteracting(true)}
                            ref={toolbarReference}
                        >
                            {showControls ? (
                                <>
                                    <label className="rich-text-image-field">
                                        <span>{t("richText.media.width")}</span>
                                        <input
                                            className="rich-text-image-input"
                                            min={MIN_WIDTH}
                                            onBlur={(event) =>
                                                applyWidth(
                                                    Number.parseInt(
                                                        event.target.value,
                                                        10
                                                    )
                                                )
                                            }
                                            onChange={(event) =>
                                                setWidthField(
                                                    event.target.value
                                                )
                                            }
                                            onKeyDown={(event) => {
                                                if (event.key === "Enter") {
                                                    event.preventDefault();
                                                    applyWidth(
                                                        Number.parseInt(
                                                            widthField,
                                                            10
                                                        )
                                                    );
                                                }
                                            }}
                                            type="number"
                                            value={widthField}
                                        />
                                    </label>
                                    <span className="rich-text-image-times">
                                        ×
                                    </span>
                                    <label className="rich-text-image-field">
                                        <span>
                                            {t("richText.media.height")}
                                        </span>
                                        <input
                                            className="rich-text-image-input"
                                            min={1}
                                            onBlur={(event) =>
                                                applyHeight(
                                                    Number.parseInt(
                                                        event.target.value,
                                                        10
                                                    )
                                                )
                                            }
                                            onChange={(event) =>
                                                setHeightField(
                                                    event.target.value
                                                )
                                            }
                                            onKeyDown={(event) => {
                                                if (event.key === "Enter") {
                                                    event.preventDefault();
                                                    applyHeight(
                                                        Number.parseInt(
                                                            heightField,
                                                            10
                                                        )
                                                    );
                                                }
                                            }}
                                            type="number"
                                            value={heightField}
                                        />
                                    </label>
                                </>
                            ) : null}
                            <button
                                aria-label={t("richText.media.open")}
                                className="rich-text-image-border-toggle"
                                onClick={openPreview}
                                onMouseDown={(event) => event.preventDefault()}
                                title={t("richText.media.open")}
                                type="button"
                            >
                                <Maximize2 className="size-4" />
                            </button>
                            <button
                                aria-label={t("richText.media.copy")}
                                className="rich-text-image-border-toggle"
                                onClick={handleCopyImage}
                                onMouseDown={(event) => event.preventDefault()}
                                title={t("richText.media.copy")}
                                type="button"
                            >
                                <Copy className="size-4" />
                            </button>
                            {showControls ? (
                                <>
                                    <button
                                        aria-label={t(
                                            "richText.media.toggleBorder"
                                        )}
                                        aria-pressed={bordered}
                                        className={cn(
                                            "rich-text-image-border-toggle",
                                            bordered && "is-active"
                                        )}
                                        onClick={toggleBorder}
                                        onMouseDown={(event) =>
                                            event.preventDefault()
                                        }
                                        title={t("richText.media.toggleBorder")}
                                        type="button"
                                    >
                                        {bordered ? (
                                            <Square className="size-4" />
                                        ) : (
                                            <SquareDashed className="size-4" />
                                        )}
                                    </button>
                                    <span className="rich-text-image-divider" />
                                    <span className="rich-text-image-align">
                                        {ALIGNMENTS.map(
                                            ({ icon: Icon, value }) => (
                                                <button
                                                    aria-label={t(
                                                        `richText.media.align.${value}`
                                                    )}
                                                    aria-pressed={
                                                        align === value
                                                    }
                                                    className={cn(
                                                        "rich-text-image-align-button",
                                                        align === value &&
                                                            "is-active"
                                                    )}
                                                    key={value}
                                                    onClick={() =>
                                                        setAlignment(value)
                                                    }
                                                    onMouseDown={(event) =>
                                                        event.preventDefault()
                                                    }
                                                    title={t(
                                                        `richText.media.align.${value}`
                                                    )}
                                                    type="button"
                                                >
                                                    <Icon className="size-4" />
                                                </button>
                                            )
                                        )}
                                    </span>
                                </>
                            ) : null}
                        </span>
                    </>
                ) : null}
            </span>

            <Dialog onOpenChange={setPreviewOpen} open={previewOpen}>
                <DialogContent
                    className={cn(
                        "flex h-dvh max-h-dvh w-full max-w-none translate-x-0 translate-y-0",
                        "top-0 left-0 items-center justify-center gap-0 rounded-none border-0",
                        "bg-black/90 p-3 shadow-none ring-0 sm:max-w-none",
                        "data-open:zoom-in-100 data-closed:zoom-out-100"
                    )}
                    showCloseButton
                >
                    <DialogTitle className="sr-only">
                        {t("richText.media.open")}
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        {alt || t("richText.media.open")}
                    </DialogDescription>
                    {source ? (
                        <img
                            alt={alt}
                            className="max-h-[min(92dvh,100%)] max-w-full object-contain"
                            src={source}
                        />
                    ) : null}
                </DialogContent>
            </Dialog>
        </NodeViewWrapper>
    );
}

function clampWidth(width: number, max: number): number {
    const upperBound = max > 0 ? max : width;
    return Math.round(Math.min(Math.max(width, MIN_WIDTH), upperBound));
}
