/**
 * Puts one line on the clipboard, through the async API where it exists.
 *
 * `navigator.clipboard` is undefined outside a secure context - every plain-http host, the dev
 * server among them - so the selection-and-`execCommand` route is kept as the fallback. It is
 * deprecated but universally implemented, and the alternative is a control that does nothing
 * on http.
 *
 * The fallback copies out of a field the **caller owns** rather than one appended to
 * `document.body`, and that is not a style choice: inside an overlay with a focus scope
 * (react-aria's popovers and dialogs) focus is pulled straight back out of anything mounted
 * outside it, a field that cannot hold the selection cannot be copied from, and `execCommand`
 * then reports success having copied nothing. Render a hidden field inside the overlay, hand its
 * ref here, and copy before dismissing the overlay that holds it.
 *
 * Rejects rather than returning a boolean, so a caller reports failure the same way for both
 * routes - the async API rejects on a denied permission.
 */
export async function copyToClipboard(
	text: string,
	fallbackField?: HTMLTextAreaElement | null,
): Promise<void> {
	if (navigator.clipboard) {
		return navigator.clipboard.writeText(text);
	}

	if (!fallbackField) {
		throw new Error('No field to copy the text from');
	}

	fallbackField.value = text;
	fallbackField.focus();
	fallbackField.setSelectionRange(0, text.length);

	if (!document.execCommand('copy')) {
		throw new Error('The clipboard refused the copy');
	}
}
