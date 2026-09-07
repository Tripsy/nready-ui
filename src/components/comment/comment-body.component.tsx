import { useMemo, useState } from 'react';
import {
	buildCommentExcerpt,
	type CommentTranslations,
} from '@/components/comment/comment.definition';
import { Button } from '@/components/ui/button';

/**
 * A comment's text, folded when it runs long.
 *
 * Plain text, deliberately: the body is whatever a visitor typed, and rendering it as markdown
 * would put their formatting - and anything an injection survives - into the page.
 * `whitespace-pre-line` keeps the paragraph breaks they intended.
 *
 * The fold is client state rather than a CSS line clamp: a clamp measures rendered height, so how
 * much survives depends on the viewport, and the text stays in the page where a search finds it
 * inside a comment that looks collapsed. A character count folds the same way everywhere and the
 * hidden half is genuinely absent until asked for.
 */
export function CommentBody({
	content,
	translations,
}: {
	content: string;
	translations: CommentTranslations;
}) {
	const [expanded, setExpanded] = useState(false);

	// The cut is pure and the content does not change while the row is mounted; recomputing it
	// would walk the whole string a second time for nothing.
	const excerpt = useMemo(() => buildCommentExcerpt(content), [content]);

	const isFolded = excerpt !== null && !expanded;

	return (
		<p className="mt-2 whitespace-pre-line text-foreground">
			{isFolded ? `${excerpt}…` : content}

			{isFolded && (
				/*
				 * One way: unfolding is what the reader asked for, and a comment that folds
				 * itself back up moves everything below it while they are reading. The control
				 * goes with the fold rather than becoming a "less".
				 *
				 * Inside the paragraph, so it sits at the end of the text it belongs to rather
				 * than on a line of its own - a thread of folded comments would otherwise grow a
				 * column of buttons down its left edge.
				 */
				<Button
					type="button"
					variant="ghost"
					onClick={() => setExpanded(true)}
					className="ml-1 text-sm text-accent hover:underline"
				>
					{translations['thread.show_more']}
				</Button>
			)}
		</p>
	);
}
