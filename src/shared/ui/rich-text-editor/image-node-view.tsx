import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import {
    AlignCenter,
    AlignLeft,
    AlignRight,
    Square,
    SquareDashed,
} from "lucide-react";
import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type PointerEvent as ReactPointerEvent,
} from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";
import { Spinner } from "@/shared/shadcn/ui/spinner";

const MIN_WIDTH = 48;

type Alignment = "center" | "left" | "right";

const ALIGNMENTS: { icon: typeof AlignLeft; value: Alignment }[] = [
    { icon: AlignLeft, value: "left" },
    { icon: AlignCenter, value: "center" },
    { icon: AlignRight, value: "right" },
];

type Corner = "ne" | "nw" | "se" | "sw";

const CORNERS: { corner: Corner; className: string; signX: number }[] = [
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

function clampWidth(width: number, max: number): number {
    const upperBound = max > 0 ? max : width;
    return Math.round(Math.min(Math.max(width, MIN_WIDTH), upperBound));
}

export function ImageNodeView({
    editor,
    getPos,
    node,
    selected,
    updateAttributes,
}: NodeViewProps) {
    const { t } = useTranslation("board");
    const imageRef = useRef<HTMLImageElement | null>(null);
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const topSentinelRef = useRef<HTMLSpanElement | null>(null);
    const bottomSentinelRef = useRef<HTMLSpanElement | null>(null);
    const aspectRef = useRef<null | number>(null);
    const [isResizing, setIsResizing] = useState(false);
    const [toolbarPlacement, setToolbarPlacement] = useState<
        "bottom" | "hidden" | "top"
    >("top");
    const [widthField, setWidthField] = useState("");
    const [heightField, setHeightField] = useState("");

    const src = node.attrs.src as string;
    const alt = (node.attrs.alt as null | string) ?? "";
    const width = node.attrs.width as null | number;
    const height = node.attrs.height as null | number;
    const bordered = Boolean(node.attrs.bordered);
    const align = (node.attrs.align as Alignment | null) ?? "left";
    const uploading = Boolean(node.attrs.uploading);
    const isEditable = editor.isEditable;
    const showControls = isEditable && selected && !uploading;

    const getAspectRatio = useCallback(() => {
        if (aspectRef.current) return aspectRef.current;
        if (width && height) return width / height;
        const image = imageRef.current;
        if (image?.naturalWidth && image.naturalHeight) {
            return image.naturalWidth / image.naturalHeight;
        }
        return null;
    }, [height, width]);

    const getMaxWidth = useCallback(() => {
        const surface = wrapperRef.current?.closest(".ProseMirror");
        return surface instanceof HTMLElement ? surface.clientWidth : 0;
    }, []);

    const syncFields = useCallback(() => {
        const image = imageRef.current;
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
        const image = imageRef.current;
        if (image?.naturalWidth && image.naturalHeight) {
            aspectRef.current = image.naturalWidth / image.naturalHeight;
        }
        syncFields();
    }, [syncFields]);

    const startResize = useCallback(
        (event: ReactPointerEvent, signX: number) => {
            event.preventDefault();
            event.stopPropagation();

            const image = imageRef.current;
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
                window.removeEventListener("pointermove", handleMove);
                window.removeEventListener("pointerup", handleUp);
            };

            window.addEventListener("pointermove", handleMove);
            window.addEventListener("pointerup", handleUp);
        },
        [getAspectRatio, getMaxWidth, updateAttributes],
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
        [getAspectRatio, getMaxWidth, updateAttributes],
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
            const clampedWidth = clampWidth(targetHeight * aspect, getMaxWidth());
            updateAttributes({
                height: Math.round(clampedWidth / aspect),
                width: clampedWidth,
            });
        },
        [getAspectRatio, getMaxWidth, updateAttributes],
    );

    const toggleBorder = useCallback(() => {
        updateAttributes({ bordered: !bordered });
    }, [bordered, updateAttributes]);

    const setAlignment = useCallback(
        (value: Alignment) => {
            updateAttributes({ align: value });
        },
        [updateAttributes],
    );

    // The image node is `user-select: none` (so a text selection dragged across
    // it isn't painted over it). A side effect is that clicking the image no
    // longer clears an active text selection, so ProseMirror's default
    // click-to-select-node fails and the resize toolbar never appears.
    //
    // Fix it with a native mousedown listener on the <img>: it runs in the
    // target phase, before the event bubbles to ProseMirror's own handler on
    // `.ProseMirror`, so stopPropagation keeps PM from processing the click at
    // all (a React onMouseDown is delegated to the root and would fire too
    // late — PM would already have run and would clobber our selection on
    // mouseup). We then select this node explicitly by its own position.
    useEffect(() => {
        const image = imageRef.current;
        if (!image || !isEditable) return;

        const handleMouseDown = (event: MouseEvent) => {
            if (event.button !== 0) return;
            const pos = typeof getPos === "function" ? getPos() : null;
            if (pos == null) return;
            event.preventDefault();
            event.stopPropagation();
            editor.chain().focus().setNodeSelection(pos).run();
        };

        image.addEventListener("mousedown", handleMouseDown);
        return () => image.removeEventListener("mousedown", handleMouseDown);
    }, [editor, getPos, isEditable]);

    useEffect(() => {
        if (width && height) {
            aspectRef.current = width / height;
        }
    }, [height, width]);

    useEffect(() => {
        syncFields();
    }, [syncFields]);

    // One observer (only while the image is selected) watching two thin probes
    // at the top and bottom of the image. Prefer the top; if it is clipped by
    // the scroll container, drop to the bottom; if neither fits, hide.
    useEffect(() => {
        if (!showControls) return;
        const image = imageRef.current;
        const topProbe = topSentinelRef.current;
        const bottomProbe = bottomSentinelRef.current;
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
                    fits.top ? "top" : fits.bottom ? "bottom" : "hidden",
                );
            },
            { threshold: [0, 1] },
        );
        observer.observe(topProbe);
        observer.observe(bottomProbe);

        return () => observer.disconnect();
    }, [showControls]);

    return (
        <NodeViewWrapper
            className="rich-text-image-view"
            data-align={align}
            data-selected={selected ? "true" : undefined}
            ref={wrapperRef}
            style={{ textAlign: align }}
        >
            <span
                className={cn(
                    "rich-text-image-frame",
                    selected && "is-selected",
                    isResizing && "is-resizing",
                )}
                style={width ? { width: `${width}px` } : undefined}
            >
                <img
                    alt={alt}
                    className="rich-text-image"
                    data-bordered={bordered ? "true" : undefined}
                    draggable={false}
                    height={height ?? undefined}
                    onLoad={handleImageLoad}
                    ref={imageRef}
                    src={src}
                    width={width ?? undefined}
                />

                {uploading ? (
                    <span className="rich-text-image-loader">
                        <Spinner className="size-6 text-white" />
                    </span>
                ) : null}

                {showControls ? (
                    <>
                        <span
                            aria-hidden
                            className="rich-text-image-sentinel is-top"
                            ref={topSentinelRef}
                        />
                        <span
                            aria-hidden
                            className="rich-text-image-sentinel is-bottom"
                            ref={bottomSentinelRef}
                        />
                        {CORNERS.map(({ className, corner, signX }) => (
                            <span
                                className={cn(
                                    "rich-text-image-handle",
                                    className,
                                )}
                                key={corner}
                                onPointerDown={(event) =>
                                    startResize(event, signX)
                                }
                            />
                        ))}

                        <span
                            className={cn(
                                "rich-text-image-toolbar",
                                toolbarPlacement === "bottom" && "is-bottom",
                                toolbarPlacement === "hidden" && "is-hidden",
                            )}
                            contentEditable={false}
                        >
                            <label className="rich-text-image-field">
                                <span>{t("richText.media.width")}</span>
                                <input
                                    className="rich-text-image-input"
                                    min={MIN_WIDTH}
                                    onBlur={(event) =>
                                        applyWidth(
                                            Number.parseInt(
                                                event.target.value,
                                                10,
                                            ),
                                        )
                                    }
                                    onChange={(event) =>
                                        setWidthField(event.target.value)
                                    }
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                            event.preventDefault();
                                            applyWidth(
                                                Number.parseInt(
                                                    widthField,
                                                    10,
                                                ),
                                            );
                                        }
                                    }}
                                    type="number"
                                    value={widthField}
                                />
                            </label>
                            <span className="rich-text-image-times">×</span>
                            <label className="rich-text-image-field">
                                <span>{t("richText.media.height")}</span>
                                <input
                                    className="rich-text-image-input"
                                    min={1}
                                    onBlur={(event) =>
                                        applyHeight(
                                            Number.parseInt(
                                                event.target.value,
                                                10,
                                            ),
                                        )
                                    }
                                    onChange={(event) =>
                                        setHeightField(event.target.value)
                                    }
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                            event.preventDefault();
                                            applyHeight(
                                                Number.parseInt(
                                                    heightField,
                                                    10,
                                                ),
                                            );
                                        }
                                    }}
                                    type="number"
                                    value={heightField}
                                />
                            </label>
                            <button
                                aria-label={t("richText.media.toggleBorder")}
                                aria-pressed={bordered}
                                className={cn(
                                    "rich-text-image-border-toggle",
                                    bordered && "is-active",
                                )}
                                onClick={toggleBorder}
                                onMouseDown={(event) => event.preventDefault()}
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
                                {ALIGNMENTS.map(({ icon: Icon, value }) => (
                                    <button
                                        aria-label={t(
                                            `richText.media.align.${value}`,
                                        )}
                                        aria-pressed={align === value}
                                        className={cn(
                                            "rich-text-image-align-button",
                                            align === value && "is-active",
                                        )}
                                        key={value}
                                        onClick={() => setAlignment(value)}
                                        onMouseDown={(event) =>
                                            event.preventDefault()
                                        }
                                        title={t(
                                            `richText.media.align.${value}`,
                                        )}
                                        type="button"
                                    >
                                        <Icon className="size-4" />
                                    </button>
                                ))}
                            </span>
                        </span>
                    </>
                ) : null}
            </span>
        </NodeViewWrapper>
    );
}
