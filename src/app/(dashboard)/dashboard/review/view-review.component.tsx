'use client';

import {
	ViewField,
	ViewRow,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { formatDate } from '@/helpers/date.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import {
	displayReviewAuthor,
	REVIEW_RATING_DIMENSIONS,
	type ReviewModel,
} from '@/models/review.model';

export function ViewReview({ entry }: { entry: ReviewModel }) {
	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">ID</span> {entry.id}
			</div>

			{/* Its own section: the text is what a moderator is here to read, and it is the one
			    field long enough to need the full width of the window rather than a third of it. */}
			<ViewSection title="Content">
				{/* The whole text, unlike the list cell, which trims it to a width - and `full`,
				    so it runs the width of the window instead of a third of it. */}
				<ViewField label="Review" value={entry.content} full />
			</ViewSection>

			<ViewSection title="Review">
				<ViewField
					label="Status"
					value={formatEnumLabel(entry.status)}
				/>
				{/* Rendered as words: `ViewField` prints a `false` as an empty cell, which reads
				    as "unknown" rather than "no". */}
				<ViewField
					label="Pinned"
					value={entry.is_pinned ? 'Yes' : 'No'}
				/>
				<ViewField
					label="Verified Buyer"
					value={entry.is_verified ? 'Yes' : 'No'}
				/>
			</ViewSection>

			{/*
			 * Rows rather than auto-flow: the four scores belong on one line, in the order the
			 * entity declares them, and the average belongs under them - it is derived from that
			 * line and reads as a total. Four to a row overrides the section's three-column grid,
			 * which would otherwise wrap `delivery` down beside the average.
			 */}
			<ViewSection title="Rating" layout="rows">
				<ViewRow className="lg:grid-cols-4">
					{/* A dimension the buyer left blank stays blank - the average is over what
					    was scored, not over the four that exist. */}
					{REVIEW_RATING_DIMENSIONS.map((dimension) => (
						<ViewField
							key={dimension}
							label={formatEnumLabel(dimension)}
							value={entry.rating?.[dimension]}
						/>
					))}
				</ViewRow>

				<ViewRow>
					{/* Just the number: the scores it averages are the row above, so repeating
					    them here would print the same four values twice. */}
					<ViewField
						label="Average"
						value={`${entry.rating_avg} / 5`}
					/>
				</ViewRow>
			</ViewSection>

			<ViewSection title="Target">
				<ViewField label="Product ID" value={entry.product_id} />
				{/* Null when the review was written from the product page rather than about one
				    variant in particular. */}
				<ViewField label="Variant ID" value={entry.variant_id} />
				<ViewField label="Variant SKU" value={entry.variant?.sku} />
				{/* Null on every review for now - the backend has nothing to derive it from yet,
				    so this reads n/a until the order wiring exists. */}
				<ViewField label="Order ID" value={entry.order_id} />
			</ViewSection>

			<ViewSection title="Author">
				<ViewField label="Author" value={displayReviewAuthor(entry)} />
				<ViewField label="User ID" value={entry.user_id} />
				<ViewField label="Email" value={entry.user?.email} />
			</ViewSection>

			<ViewSection title="Moderation">
				<ViewField
					label="Moderated At"
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
					label="Moderated By"
					value={
						entry.moderator
							? `${entry.moderator.name} (#${entry.moderated_by})`
							: entry.moderated_by
					}
				/>
				{/* Overwritten by each decision: it describes the state the review is in now,
				    not how it got here. */}
				<ViewField label="Reason" value={entry.moderation_reason} />
			</ViewSection>

			<ViewSection title="Timestamps">
				<ViewField
					label="Created At"
					value={formatDate(entry.created_at, 'date-time')}
				/>
				<ViewField
					label="Updated At"
					value={
						entry.updated_at
							? formatDate(entry.updated_at, 'date-time')
							: undefined
					}
				/>
				<ViewField
					label="Deleted At"
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
