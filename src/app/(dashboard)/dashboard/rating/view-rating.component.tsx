'use client';

import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { formatDate } from '@/helpers/date.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import {
	displayRatingValue,
	type RatingModel,
	wasRatingChanged,
} from '@/models/rating.model';

export function ViewRating({ entry }: { entry: RatingModel }) {
	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">ID</span> {entry.id}
			</div>

			<ViewSection title="Target">
				<ViewField
					label="Entity Type"
					value={formatEnumLabel(entry.entity_type)}
				/>
				<ViewField label="Entity ID" value={entry.entity_id} />
			</ViewSection>

			<ViewSection title="Rating">
				<ViewField label="Type" value={formatEnumLabel(entry.type)} />
				<ViewField label="Rating" value={displayRatingValue(entry)} />
				{/* Both raw columns are shown as well: the combined cell above reads well but
				    hides which of the two the row actually carries. */}
				<ViewField label="Value" value={entry.value} />
				<ViewField label="Reaction" value={entry.reaction} />
			</ViewSection>

			<ViewSection title="Rated By">
				{/* A rating cast without an account is anchored to the origin address alone,
				    which the backend never returns — so there is nothing to show beyond this. */}
				<ViewField
					label="User"
					value={entry.user ? entry.user.name : 'Guest'}
				/>
				<ViewField label="User ID" value={entry.user_id} />
				<ViewField label="Email" value={entry.user?.email} />
			</ViewSection>

			<ViewSection title="Timestamps">
				<ViewField
					label="Created At"
					value={formatDate(entry.created_at, 'date-time')}
				/>
				<ViewField
					label="Updated At"
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
