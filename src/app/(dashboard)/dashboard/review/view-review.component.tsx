'use client';

import {
	ViewField,
	ViewRow,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { formatDate } from '@/helpers/date.helper';
import {
	enumTranslationKeys,
	translateEnumLabel,
} from '@/helpers/string.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import {
	displayReviewAuthor,
	REVIEW_RATING_DIMENSIONS,
	type ReviewModel,
	ReviewStatusEnum,
} from '@/models/review.model';

const TRANSLATION_KEYS = [
	'review.field.author',
	'review.field.content',
	'review.field.created_at',
	'review.field.deleted_at',
	'review.field.email',
	'review.field.id',
	'review.field.is_pinned',
	'review.field.is_verified',
	'review.field.moderated_at',
	'review.field.moderation_reason',
	'review.field.moderator',
	'review.field.order_id',
	'review.field.product_id',
	'review.field.rating_avg',
	'review.field.sku',
	'review.field.status',
	'review.field.updated_at',
	'review.field.user_id',
	'review.field.variant_id',
	'review.section.author',
	'review.section.content',
	'review.section.moderation',
	'review.section.rating',
	'review.section.review',
	'review.section.target',
	'review.section.timestamps',
	'dashboard.text.yes',
	'dashboard.text.no',
	...enumTranslationKeys('review.status', ReviewStatusEnum),
	...enumTranslationKeys('review.enum.dimension', REVIEW_RATING_DIMENSIONS),
] as const;

export function ViewReview({ entry }: { entry: ReviewModel }) {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">
					{translations['review.field.id']}
				</span>{' '}
				{entry.id}
			</div>

			{/* Its own section: the text is what a moderator is here to read, and it is the one
			    field long enough to need the full width of the window rather than a third of it. */}
			<ViewSection title={translations['review.section.content']}>
				{/* The whole text, unlike the list cell, which trims it to a width - and `full`,
				    so it runs the width of the window instead of a third of it. */}
				<ViewField
					label={translations['review.field.content']}
					value={entry.content}
					full
				/>
			</ViewSection>

			<ViewSection title={translations['review.section.review']}>
				<ViewField
					label={translations['review.field.status']}
					value={translateEnumLabel(
						translations,
						'review.status',
						entry.status,
					)}
				/>
				{/* Rendered as words: `ViewField` prints a `false` as an empty cell, which reads
				    as "unknown" rather than "no". */}
				<ViewField
					label={translations['review.field.is_pinned']}
					value={
						entry.is_pinned
							? translations['dashboard.text.yes']
							: translations['dashboard.text.no']
					}
				/>
				<ViewField
					label={translations['review.field.is_verified']}
					value={
						entry.is_verified
							? translations['dashboard.text.yes']
							: translations['dashboard.text.no']
					}
				/>
			</ViewSection>

			{/*
			 * Rows rather than auto-flow: the four scores belong on one line, in the order the
			 * entity declares them, and the average belongs under them - it is derived from that
			 * line and reads as a total. Four to a row overrides the section's three-column grid,
			 * which would otherwise wrap `delivery` down beside the average.
			 */}
			<ViewSection
				title={translations['review.section.rating']}
				layout="rows"
			>
				<ViewRow className="lg:grid-cols-4">
					{/* A dimension the buyer left blank stays blank - the average is over what
					    was scored, not over the four that exist. */}
					{REVIEW_RATING_DIMENSIONS.map((dimension) => (
						<ViewField
							key={dimension}
							label={translateEnumLabel(
								translations,
								'review.enum.dimension',
								dimension,
							)}
							value={entry.rating?.[dimension]}
						/>
					))}
				</ViewRow>

				<ViewRow>
					{/* Just the number: the scores it averages are the row above, so repeating
					    them here would print the same four values twice. */}
					<ViewField
						label={translations['review.field.rating_avg']}
						value={`${entry.rating_avg} / 5`}
					/>
				</ViewRow>
			</ViewSection>

			<ViewSection title={translations['review.section.target']}>
				<ViewField
					label={translations['review.field.product_id']}
					value={entry.product_id}
				/>
				{/* Null when the review was written from the product page rather than about one
				    variant in particular. */}
				<ViewField
					label={translations['review.field.variant_id']}
					value={entry.variant_id}
				/>
				<ViewField
					label={translations['review.field.sku']}
					value={entry.variant?.sku}
				/>
				{/* Null on every review for now - the backend has nothing to derive it from yet,
				    so this reads n/a until the order wiring exists. */}
				<ViewField
					label={translations['review.field.order_id']}
					value={entry.order_id}
				/>
			</ViewSection>

			<ViewSection title={translations['review.section.author']}>
				<ViewField
					label={translations['review.field.author']}
					value={displayReviewAuthor(entry)}
				/>
				<ViewField
					label={translations['review.field.user_id']}
					value={entry.user_id}
				/>
				<ViewField
					label={translations['review.field.email']}
					value={entry.user?.email}
				/>
			</ViewSection>

			<ViewSection title={translations['review.section.moderation']}>
				<ViewField
					label={translations['review.field.moderated_at']}
					value={
						entry.moderated_at
							? formatDate(entry.moderated_at, 'date-time')
							: undefined
					}
				/>
				{/*
				 * The moderator by name, with the id beside it - an audit trail is read by
				 * whoever is being asked about a decision, and a bare number answers nothing.
				 * The name is absent in two cases the empty cell cannot tell apart: nobody
				 * decided (a background sweep), or the account has since been deleted, since the
				 * id is stored without a foreign key so the trail outlives the user. `n/a`
				 * against a filled `Moderated At` is the second one.
				 */}
				<ViewField
					label={translations['review.field.moderator']}
					value={
						entry.moderator
							? `${entry.moderator.name} (#${entry.moderated_by})`
							: entry.moderated_by
					}
				/>
				{/* Overwritten by each decision: it describes the state the review is in now,
				    not how it got here. */}
				<ViewField
					label={translations['review.field.moderation_reason']}
					value={entry.moderation_reason}
				/>
			</ViewSection>

			<ViewSection title={translations['review.section.timestamps']}>
				<ViewField
					label={translations['review.field.created_at']}
					value={formatDate(entry.created_at, 'date-time')}
				/>
				<ViewField
					label={translations['review.field.updated_at']}
					value={
						entry.updated_at
							? formatDate(entry.updated_at, 'date-time')
							: undefined
					}
				/>
				<ViewField
					label={translations['review.field.deleted_at']}
					value={
						entry.deleted_at
							? formatDate(entry.deleted_at, 'date-time')
							: undefined
					}
				/>
			</ViewSection>
		</div>
	);
}
