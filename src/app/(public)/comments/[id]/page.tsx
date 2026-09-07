import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { commentAnchorId } from '@/components/comment/comment.definition';
import { resolveCommentTargetPath } from '@/config/comment-target.config';
import { getLanguage } from '@/config/translate.setup';
import { getResponseData } from '@/helpers/api.helper';
import { logger } from '@/helpers/logger.helper';
import type { CommentLocationModel } from '@/models/comment.model';
import { requestCommentLocation } from '@/services/comment.service';

export const metadata: Metadata = {
	// A redirect nobody should land on twice, carrying no content of its own.
	robots: 'noindex, nofollow',
};

type Props = {
	params: Promise<{ id: string }>;
};

/**
 * The permalink a notification email links a comment by: `/comments/:id` resolves where the comment
 * lives and sends the reader on to the page it is on, anchored at the comment itself.
 *
 * Resolved here rather than written into the email, and that is the point. A link in an inbox
 * outlives the address it pointed at - an article can be re-slugged or re-filed under another
 * category - so the email carries the one thing that never changes, the comment's id, and the
 * address is rebuilt at the moment somebody clicks.
 *
 * Nothing on this page knows what a comment hangs from. The backend answers with a polymorphic
 * target (`entity_type` + `entity_id`) and `comment-target.config.ts` turns that into a path, so a
 * new kind of commentable thing is an entry in that registry rather than a branch here.
 */
export default async function Page(props: Props) {
	const { id } = await props.params;

	const commentId = Number(id);

	if (!Number.isInteger(commentId) || commentId <= 0) {
		notFound();
	}

	const language = await getLanguage();

	const location = await requestCommentLocation(commentId)
		.then((response) => getResponseData<CommentLocationModel>(response))
		.catch((error) => {
			// A 404 is the ordinary answer here - a comment moderated away since the email
			// went out - so this only records the rest.
			logger.debug('Could not resolve the comment permalink', error, {
				commentId,
			});

			return null;
		});

	const targetPath = location
		? await resolveCommentTargetPath(
				location.entity_type,
				location.entity_id,
				language,
			)
		: null;

	// Either the comment is gone, or its target is - no page to send the reader to.
	if (!location || !targetPath) {
		notFound();
	}

	// Outside the lookups above: `redirect` throws to unwind, and a `catch` around it would
	// swallow the redirect itself.
	redirect(`${targetPath}#${commentAnchorId(location)}`);
}
