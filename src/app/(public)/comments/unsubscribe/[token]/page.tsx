import type { Metadata } from 'next';
import Link from 'next/link';
import {
	CommentUnsubscribe,
	type CommentUnsubscribeTranslations,
} from '@/app/(public)/comments/unsubscribe/[token]/comment-unsubscribe.component';
import { ErrorComponent } from '@/components/status.component';
import Routes from '@/config/routes.setup';
import { Configuration } from '@/config/settings.config';
import { translate, translateBatch } from '@/config/translate.setup';
import { getResponseData } from '@/helpers/api.helper';
import type { CommentSubscriptionModel } from '@/models/comment.model';
import { requestCommentSubscription } from '@/services/comment.service';
import type { Language } from '@/types/common.type';

const TRANSLATION_PREFIX = 'comment';

const TRANSLATION_KEYS = [
	'unsubscribe.heading',
	'unsubscribe.intro',
	'unsubscribe.all',
	'unsubscribe.replies_to_me',
	'unsubscribe.unsubscribed',
	'unsubscribe.save',
	'unsubscribe.saving',
	'unsubscribe.saved',
	'unsubscribe.failed',
	'unsubscribe.invalid',
	'unsubscribe.back',
] as const;

type Props = {
	params: Promise<{ token: string }>;
};

/**
 * The subscription behind the link, or null. Called from both `generateMetadata` and the page -
 * Next memorizes a GET `fetch` across them within one render, so this costs one request, and the
 * title would otherwise be in a different language from the page under it.
 */
async function getSubscription(
	token: string,
): Promise<CommentSubscriptionModel | null> {
	return requestCommentSubscription(token)
		.then(
			(response) =>
				getResponseData<CommentSubscriptionModel>(response) ?? null,
		)
		.catch(() => null);
}

export async function generateMetadata(props: Props): Promise<Metadata> {
	const { token } = await props.params;
	const subscription = await getSubscription(token);

	return {
		title: await translate(
			'comment.unsubscribe.meta_title',
			{ app_name: Configuration.get('app.name') },
			subscription?.language as Language | undefined,
		),
		// A link out of an email is nobody's landing page, and it carries a credential in its path.
		robots: 'noindex, nofollow',
	};
}

/**
 * Where a notification email's "manage or stop these notifications" link lands.
 *
 * The subscription is read server-side (`remote-api`): the token in the path is the only
 * credential, so there is no session for the proxy to attach, and the answer belongs to whoever
 * holds the link - it is never cached. A token that opens nothing renders the error below rather
 * than a form that cannot be saved.
 */
export default async function Page(props: Props) {
	const { token } = await props.params;

	const subscription = await getSubscription(token);

	/*
	 * The subscriber's own language, not the browser's: they are arriving from an email written
	 * in it, quite possibly in a browser that has never been to the site. `translateBatch` falls
	 * back to the visitor's language if the stored one is no longer supported.
	 *
	 * Sequential rather than in parallel with the read for the same reason - the language is in
	 * the answer. One extra round trip on a page nobody loads twice.
	 */
	const translations = await translateBatch(
		TRANSLATION_KEYS,
		TRANSLATION_PREFIX,
		subscription?.language as Language | undefined,
	);

	if (!subscription) {
		return (
			<ErrorComponent
				title={translations['unsubscribe.heading']}
				description={translations['unsubscribe.invalid']}
			>
				<div className="mt-6 text-center">
					<Link
						href={Routes.get('home')}
						className="font-medium text-accent hover:underline"
					>
						{translations['unsubscribe.back']}
					</Link>
				</div>
			</ErrorComponent>
		);
	}

	return (
		<div className="container-default py-12 md:py-16">
			<div className="mx-auto max-w-xl">
				<h1 className="text-2xl font-semibold">
					{translations['unsubscribe.heading']}
				</h1>

				{/* The address is echoed back so the reader can see which of theirs this is -
				    it is the one the email they followed was sent to. */}
				<p className="mt-2 text-sm text-muted">
					{translations['unsubscribe.intro']}{' '}
					{subscription.user_email}
				</p>

				<CommentUnsubscribe
					token={token}
					notificationType={subscription.notification_type}
					translations={
						translations as CommentUnsubscribeTranslations
					}
				/>
			</div>
		</div>
	);
}
