'use client';

import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { formatDate } from '@/helpers/date.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import type { AddressModel } from '@/models/address.model';

const TRANSLATION_KEYS = [
	'address.field.created_at',
	'address.field.details',
	'address.field.id',
	'address.field.postal_code',
	'address.field.updated_at',
	'address.section.details',
	'address.section.timestamps',
] as const;

export function ViewAddress({ entry }: { entry: AddressModel }) {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">
					{translations['address.field.id']}
				</span>{' '}
				{entry.id}
			</div>

			<ViewSection title={translations['address.section.details']}>
				<ViewField
					label={translations['address.field.details']}
					value={entry.details}
				/>
				<ViewField
					label={translations['address.field.postal_code']}
					value={entry.postal_code}
				/>
			</ViewSection>

			<ViewSection title={translations['address.section.timestamps']}>
				<ViewField
					label={translations['address.field.created_at']}
					value={formatDate(entry.created_at, 'date-time')}
				/>
				<ViewField
					label={translations['address.field.updated_at']}
					value={formatDate(entry.updated_at, 'date-time')}
				/>
			</ViewSection>
		</div>
	);
}
