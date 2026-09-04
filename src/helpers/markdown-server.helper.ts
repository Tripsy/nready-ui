import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

/**
 * Renders editor-authored markdown to sanitized HTML **on the server** — an article's body,
 * a product's description, and anything else a public page has to put in the crawler's HTML.
 *
 * The browser twin (`renderMarkdown`) sanitizes with `DOMPurify`, which needs a real DOM and
 * so cannot run here. `sanitize-html` parses with its own tokenizer instead, which is why
 * this is a separate module rather than a branch inside the other one: importing it from a
 * client component would pull the parser into the browser bundle for nothing.
 *
 * The allow-list mirrors `safeHtml` in `nready-api` — the source is editor free text that
 * markdown lets raw HTML through, so the same tags are permitted on both sides and a body
 * that survives one pass survives the other.
 *
 * Public pages are server-rendered for SEO, which is what forces sanitizing here: the body has
 * to be in the HTML the crawler receives, not injected on hydration.
 */
export function renderMarkdownServer(value: string | null | undefined): string {
	if (!value) {
		return '';
	}

	// `async: false` pins the synchronous overload — `marked.parse` is typed to return a
	// promise otherwise, and a rendered `[object Promise]` is the failure mode.
	const html = marked.parse(value, { async: false, gfm: true });

	return sanitizeHtml(html, {
		allowedTags: [
			'p',
			'br',
			'hr',
			'strong',
			'em',
			'i',
			'b',
			'u',
			'del',
			'span',
			'div',
			'h1',
			'h2',
			'h3',
			'h4',
			'h5',
			'h6',
			'ul',
			'ol',
			'li',
			'blockquote',
			'code',
			'pre',
			'a',
			'img',
			'table',
			'thead',
			'tbody',
			'tr',
			'th',
			'td',
		],
		allowedAttributes: {
			a: ['href', 'title', 'target', 'rel'],
			img: ['src', 'alt', 'title', 'width', 'height'],
			// GFM fenced blocks carry the language as `language-*`, which the styling reads.
			code: ['class'],
			th: ['align'],
			td: ['align'],
		},
		disallowedTagsMode: 'discard',
		allowedSchemes: ['http', 'https', 'mailto'],
		allowProtocolRelative: false,
	});
}
