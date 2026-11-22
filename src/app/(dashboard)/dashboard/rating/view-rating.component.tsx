'use client';

import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { formatDate } from '@/helpers/date.helper';
import {
	enumTranslationKeys,
	translateEnumLabel,
} from '@/helpers/string.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import {
	displayRatingValue,
	RatingEmojiEnum,
	RatingEntityTypeEnum,
	type RatingModel,
	RatingTypeEnum,
	wasRatingChanged,
} from '@/models/rating.model';

const TRANSLATION_KEYS = [
	'rating.field.created_at',
	'rating.field.email',
	'rating.field.entity_id',
	'rating.field.entity_type',
	'rating.field.id',
	'rating.field.rating',
	'rating.field.reaction',
	'rating.field.type',
	'rating.field.updated_at',
	'rating.field.user',
	'rating.field.user_id',
	'rating.field.value',
	'rating.section.rated_by',
	'rating.section.rating',
	'rating.section.target',
	'rating.section.timestamps',
	'dashboard.text.guest',
	...enumTranslationKeys('rating.enum.entity_type', RatingEntityTypeEnum),
	...enumTranslationKeys('rating.enum.type', RatingTypeEnum),
	...enumTranslationKeys('rating.enum.emoji', RatingEmojiEnum),
] as const;

export function ViewRating({ entry }: { entry: RatingModel }) {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">
					{translations['rating.field.id']}
				</span>{' '}
				{entry.id}
			</div>

			<ViewSection title={translations['rating.section.target']}>
				<ViewField
					label={translations['rating.field.entity_type']}
					value={translateEnumLabel(
						translations,
						'rating.enum.entity_type',
						entry.entity_type,
					)}
				/>
				<ViewField
					label={translations['rating.field.entity_id']}
					value={entry.entity_id}
				/>
			</ViewSection>

			<ViewSection title={translations['rating.section.rating']}>
				<ViewField
					label={translations['rating.field.type']}
					value={translateEnumLabel(
						translations,
						'rating.enum.type',
						entry.type,
					)}
				/>
				<ViewField
					label={translations['rating.field.rating']}
					value={displayRatingValue(entry, (reaction) =>
						translateEnumLabel(
							translations,
							'rating.enum.emoji',
							reaction,
						),
					)}
				/>
				{/* Both raw columns are shown as well: the combined cell above reads well but
				    hides which of the two the row actually carries. */}
				<ViewField
					label={translations['rating.field.value']}
					value={entry.value}
				/>
				<ViewField
					label={translations['rating.field.reaction']}
					value={
						entry.reaction &&
						translateEnumLabel(
							translations,
							'rating.enum.emoji',
							entry.reaction,
						)
					}
				/>
			</ViewSection>

			<ViewSection title={translations['rating.section.rated_by']}>
				{/* A rating cast without an account is anchored to the origin address alone,
				    which the backend never returns - so there is nothing to show beyond this. */}
				<ViewField
					label={translations['rating.field.user']}
					value={
						entry.user
							? entry.user.name
							: translations['dashboard.text.guest']
					}
				/>
				<ViewField
					label={translations['rating.field.user_id']}
					value={entry.user_id}
				/>
				<ViewField
					label={translations['rating.field.email']}
					value={entry.user?.email}
				/>
			</ViewSection>

			<ViewSection title={translations['rating.section.timestamps']}>
				<ViewField
					label={translations['rating.field.created_at']}
					value={formatDate(entry.created_at, 'date-time')}
				/>
				<ViewField
					label={translations['rating.field.updated_at']}
					value={
						wasRatingChanged(entry) && entry.updated_at
							? formatDate(entry.updated_at, 'date-time')
							: undefined
					}
				/>
			</ViewSection>
		</div>
	);
}
