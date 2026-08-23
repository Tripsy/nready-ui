import { Icons } from '@/components/icon.component';
import { Configuration } from '@/config/settings.config';

export const ARTICLE_SHARE_TRANSLATION_KEYS = [
	'text.share',
	'text.share_facebook',
	'text.share_x',
	'text.share_whatsapp',
] as const;

export type ArticleShareTranslations = Record<
	(typeof ARTICLE_SHARE_TRANSLATION_KEYS)[number],
	string
>;

/**
 * The absolute address a network has to be handed — a share target is resolved on the
 * network's servers, so the relative path the router works in is meaningless there.
 * `app.url` is the public origin, which is also what the canonical/metadata layer uses.
 */
function buildShareUrl(path: string): string {
	return new URL(path, Configuration.get('app.url')).toString();
}

/**
 * Share links for one article: plain anchors, no client bundle.
 *
 * Each network takes the target as a query parameter and renders its own dialog, so nothing
 * here needs to run in the browser. `noreferrer` keeps the reader's current address out of
 * the request; `target="_blank"` leaves the article open behind the dialog.
 */
export function ArticleShare({
	path,
	title,
	translations,
}: {
	/** Site-relative path of the article being shared. */
	path: string;
	title: string;
	translations: ArticleShareTranslations;
}) {
	const url = buildShareUrl(path);
	const encodedUrl = encodeURIComponent(url);
	const encodedTitle = encodeURIComponent(title);

	const targets = [
		{
			key: 'facebook',
			label: translations['text.share_facebook'],
			href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
			Icon: Icons.Social.Facebook,
			hoverClassName: 'hover:bg-accent hover:text-accent-foreground',
		},
		{
			key: 'x',
			label: translations['text.share_x'],
			href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
			Icon: Icons.Social.X,
			/*
			 * The theme's own ink rather than a literal black, which is also what X's mark
			 * does: black on a light page, white on a dark one. `bg-black` would sink into
			 * the dark theme's background and leave the glyph floating.
			 */
			hoverClassName: 'hover:bg-foreground hover:text-background',
		},
		{
			key: 'whatsapp',
			label: translations['text.share_whatsapp'],
			// WhatsApp takes one free-text field rather than separate title/url parameters.
			href: `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
			Icon: Icons.Social.WhatsApp,
			// WhatsApp brand green; no palette token comes close enough to stand in.
			hoverClassName: 'hover:bg-[#25d366] hover:text-white',
		},
	];

	return (
		<div className="flex items-center gap-3">
			<span className="sr-only">{translations['text.share']}</span>

			{targets.map(({ key, label, href, Icon, hoverClassName }) => (
				<a
					key={key}
					href={href}
					target="_blank"
					rel="noopener noreferrer"
					title={label}
					aria-label={label}
					className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${hoverClassName}`}
				>
					<Icon className="h-5 w-5" />
				</a>
			))}
		</div>
	);
}
