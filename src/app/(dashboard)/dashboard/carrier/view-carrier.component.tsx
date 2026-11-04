'use client';

import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { formatDate } from '@/helpers/date.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import type { CarrierModel } from '@/models/carrier.model';

const TRANSLATION_KEYS = [
	'carrier.field.created_at',
	'carrier.field.deleted_at',
	'carrier.field.email',
	'carrier.field.id',
	'carrier.field.notes',
	'carrier.field.phone',
	'carrier.field.updated_at',
	'carrier.field.website',
	'carrier.section.contact',
	'carrier.section.other',
	'carrier.section.timestamps',
] as const;

export function ViewCarrier({ entry }: { entry: CarrierModel }) {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">
					{translations['carrier.field.id']}
				</span>{' '}
				{entry.id}
				<span className="ml-2">{entry.name}</span>
			</div>

			<ViewSection title={translations['carrier.section.contact']}>
				<ViewField
					label={translations['carrier.field.website']}
					value={entry.website}
				/>
				<ViewField
					label={translations['carrier.field.phone']}
					value={entry.phone}
				/>
				<ViewField
					label={translations['carrier.field.email']}
					value={entry.email}
				/>
			</ViewSection>

			<ViewSection title={translations['carrier.section.other']}>
				<ViewField
					label={translations['carrier.field.notes']}
					value={entry.notes}
					full
				/>
			</ViewSection>

			<ViewSection title={translations['carrier.section.timestamps']}>
				<ViewField
					label={translations['carrier.field.created_at']}
					value={formatDate(entry.created_at, 'date-time')}
				/>
				<ViewField
					label={translations['carrier.field.updated_at']}
					value={formatDate(entry.updated_at, 'date-time')}
				/>
				{entry.deleted_at && (
					<ViewField
						label={translations['carrier.field.deleted_at']}
						value={
							<span className="text-danger">
								{formatDate(entry.deleted_at, 'date-time')}
							</span>
						}
					/>
				)}
			</ViewSection>
		</div>
	);
}
