import DOMPurify from 'dompurify';
import { marked } from 'marked';

/**
 * Renders editor-authored markdown to sanitized HTML — an article's body, a product's
 * description, and anything else a dashboard form captures as markdown.
 *
 * **Browser only.** `DOMPurify` needs a real DOM to parse into, so every caller has to be a
 * client component — there is no server fallback here on purpose: returning unsanitized HTML
 * when the DOM is missing would make the unsafe path the silent one.
 *
 * Markdown allows raw HTML through, and the source is an editor's free text, so the sanitizer
 * is not optional decoration: it is what makes the result safe to inject. Keep the two calls
 * together — parsing without sanitizing is a stored-XSS hole.
 */
export function renderMarkdown(value: string | null | undefined): string {
	if (!value) {
		return '';
	}

	// `async: false` pins the synchronous overload — `marked.parse` is typed to return a
	// promise otherwise, and a rendered `[object Promise]` is the failure mode.
	const html = marked.parse(value, { async: false, gfm: true });

	return DOMPurify.sanitize(html);
}
