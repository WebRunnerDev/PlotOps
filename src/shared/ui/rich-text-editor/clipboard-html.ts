/** True when clipboard HTML should win over a screenshot/file on the same paste. */
export function shouldPreferClipboardHtml(html: string): boolean {
    return /<table[\s>]/i.test(html);
}
