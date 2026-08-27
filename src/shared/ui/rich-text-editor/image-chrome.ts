/**
 * Image NodeView chrome (resize handles, width/height fields, copy/open).
 *
 * Boot/`setContent` can leave a NodeSelection on an image without focus, so we
 * normally require the editor to be focused. Width/height inputs live in a
 * `contentEditable={false}` island: focusing them blurs the editor. If chrome
 * then unmounts mid-click, a double-click meant to select the field value
 * lands on the bitmap and opens the fullscreen preview instead.
 */
export function shouldShowImageChrome(options: {
    editorFocused: boolean;
    selected: boolean;
    toolbarInteracting: boolean;
    uploading: boolean;
}): boolean {
    if (!options.selected || options.uploading) return false;
    return options.editorFocused || options.toolbarInteracting;
}
