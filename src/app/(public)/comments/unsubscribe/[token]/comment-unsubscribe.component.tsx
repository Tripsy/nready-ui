'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/helpers/css.helper';
import { getErrorMessage } from '@/helpers/error.helper';
import {
	type CommentSubscriptionType,
	CommentSubscriptionTypeEnum,
} from '@/models/comment.model';
import { requestUpdateCommentSubscription } from '@/services/comment.service';

export type CommentUnsubscribeTranslations = {
	'unsubscribe.heading': string;
	'unsubscribe.intro': string;
	'unsubscribe.all': string;
	'unsubscribe.replies_to_me': string;
	'unsubscribe.unsubscribed': string;
	'unsubscribe.save': string;
	'unsubscribe.saving': string;
	'unsubscribe.saved': string;
	'unsubscribe.failed': string;
};

const CHOICES: {
	value: CommentSubscriptionType;
	labelKey: keyof CommentUnsubscribeTranslations;
}[] = [
	{ value: CommentSubscriptionTypeEnum.ALL, labelKey: 'unsubscribe.all' },
	{
		value: CommentSubscriptionTypeEnum.REPLIES_TO_ME,
		labelKey: 'unsubscribe.replies_to_me',
	},
	{
		value: CommentSubscriptionTypeEnum.UNSUBSCRIBED,
		labelKey: 'unsubscribe.unsubscribed',
	},
];

/**
 * The choice itself. Three options rather than a single "unsubscribe" button: somebody who followed
 * a link to stop a busy discussion usually wants fewer emails rather than none, and offering only
 * the exit makes that the only answer they can give.
 *
 * No form pipeline — there is one enum field and no validation to speak of, so this is a mutation
 * (`data-fetching.md` allows it for a secondary write of exactly this shape).
 */
export function CommentUnsubscribe({
	token,
	notificationType,
	translations,
}: {
	token: string;
	notificationType: CommentSubscriptionType;
	translations: CommentUnsubscribeTranslations;
}) {
	const [selected, setSelected] =
		useState<CommentSubscriptionType>(notificationType);

	const { mutate, isPending, isSuccess, error } = useMutation({
		mutationFn: () => requestUpdateCommentSubscription(token, selected),
	});

	return (
		<div className="mt-6 space-y-4">
			<fieldset className="space-y-2">
				<legend className="sr-only">
					{translations['unsubscribe.heading']}
				</legend>

				{CHOICES.map(({ value, labelKey }) => (
					<label
						key={value}
						className={cn(
							'flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors',
							selected === value
								? 'border-accent bg-accent-soft text-accent-soft-foreground'
								: 'border-line hover:bg-accent-soft/50',
						)}
					>
						<input
							type="radio"
							name="notification_type"
							value={value}
							checked={selected === value}
							disabled={isPending}
							onChange={() => setSelected(value)}
						/>
						{translations[labelKey]}
					</label>
				))}
			</fieldset>

			<div className="flex flex-wrap items-center gap-3">
				<Button
					type="button"
					onClick={() => mutate()}
					disabled={isPending}
				>
					{isPending
						? translations['unsubscribe.saving']
						: translations['unsubscribe.save']}
				</Button>

				{isSuccess && (
					<span className="text-sm text-success">
						{translations['unsubscribe.saved']}
					</span>
				)}

				{error && (
					<span className="text-sm text-danger">
						{/* The backend's own wording where it has one — a spent link says so. */}
						{getErrorMessage(error) ||
							translations['unsubscribe.failed']}
					</span>
				)}
			</div>
		</div>
	);
}
