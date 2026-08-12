import type { Metadata } from 'next';
import Link from 'next/link';
import {
	ErrorComponent,
	SuccessComponent,
} from '@/components/status.component';
import Routes from '@/config/routes.setup';
import { Configuration } from '@/config/settings.config';
import { translate, translateBatch } from '@/config/translate.setup';
import { ApiError } from '@/exceptions/api.error';
import { requestEmailConfirm } from '@/services/account.service';

const EMAIL_CONFIRM_TRANSLATION_KEYS = [
	'email-confirm.form.title',
	'email-confirm.link.success_prompt',
	'email-confirm.link.account',
	'email-confirm.link.account_title',
	'email-confirm.link.or_navigate',
	'email-confirm.link.home',
	'email-confirm.link.error_prompt',
	'email-confirm.link.register',
	'email-confirm.link.register_title',
	'email-confirm.link.or_request',
	'email-confirm.link.confirm_again',
	'email-confirm.link.confirm_again_title',
] as const;

interface Props {
	params: Promise<{
		token: string;
	}>;
}

export async function generateMetadata(): Promise<Metadata> {
	return {
		title: await translate('email-confirm.meta.title', {
			app_name: Configuration.get('app.name'),
		}),
		robots: 'noindex, nofollow',
	};
}

export default async function Page(props: Props) {
	const { params } = props;

	const resolvedParams = await params;
	const token = resolvedParams.token;

	let message: string;
	let success = false;

	try {
		const requestResponse = await requestEmailConfirm(token);

		if (requestResponse?.success === false) {
			message =
				requestResponse?.message ||
				(await translate('email-confirm.message.failed'));
		} else {
			success = true;
			message = await translate('email-confirm.message.success');
		}
	} catch (error: unknown) {
		if (error instanceof ApiError) {
			message = error.message;
		} else {
			message = await translate('email-confirm.message.failed');
		}
	}

	const t = await translateBatch(EMAIL_CONFIRM_TRANSLATION_KEYS);

	if (success) {
		return (
			<SuccessComponent
				title={t['email-confirm.form.title']}
				description={message}
			>
				<div className="text-center mt-6">
					{t['email-confirm.link.success_prompt']}{' '}
					<Link
						href={Routes.get('account-me')}
						className="text-accent font-medium hover:underline"
						title={t['email-confirm.link.account_title']}
					>
						{t['email-confirm.link.account']}
					</Link>{' '}
					{t['email-confirm.link.or_navigate']}{' '}
					<Link
						href={Routes.get('home')}
						className="text-accent font-medium hover:underline"
					>
						{t['email-confirm.link.home']}
					</Link>
				</div>
			</SuccessComponent>
		);
	}

	return (
		<ErrorComponent
			title={t['email-confirm.form.title']}
			description={message}
		>
			<div className="text-center mt-6">
				{t['email-confirm.link.error_prompt']}{' '}
				<Link
					href={Routes.get('register')}
					className="text-accent font-medium hover:underline"
					title={t['email-confirm.link.register_title']}
				>
					{t['email-confirm.link.register']}
				</Link>{' '}
				{t['email-confirm.link.or_request']}{' '}
				<Link
					href={Routes.get('email-confirm-send')}
					className="text-accent font-medium hover:underline"
					title={t['email-confirm.link.confirm_again_title']}
				>
					{t['email-confirm.link.confirm_again']}
				</Link>
			</div>
		</ErrorComponent>
	);
}
