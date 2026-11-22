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
	VatRateCategoryEnum,
	type VatRateModel,
} from '@/models/vat-rate.model';

const TRANSLATION_KEYS = [
	'vat-rate.field.id',
	'vat-rate.field.country_code',
	'vat-rate.field.category',
	'vat-rate.field.rate',
	'vat-rate.field.valid_from',
	'vat-rate.field.notes',
	'vat-rate.field.created_at',
	'vat-rate.field.updated_at',
	'vat-rate.section.rate',
	'vat-rate.section.other',
	'vat-rate.section.timestamps',
	...enumTranslationKeys('vat-rate.enum.category', VatRateCategoryEnum),
] as const;

export function ViewVatRate({ entry }: { entry: VatRateModel }) {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const category = translateEnumLabel(
		translations,
		'vat-rate.enum.category',
		entry.category,
	);

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">
					{translations['vat-rate.field.id']}
				</span>{' '}
				{entry.id}
				<span className="ml-2">
					{entry.country_code} - {category}: {entry.rate}%
				</span>
			</div>

			<ViewSection title={translations['vat-rate.section.rate']}>
				<ViewField
					label={translations['vat-rate.field.country_code']}
					value={entry.country_code}
				/>
				<ViewField
					label={translations['vat-rate.field.category']}
					value={category}
				/>
				<ViewField
					label={translations['vat-rate.field.rate']}
					value={`${entry.rate}%`}
				/>
				<ViewField
					label={translations['vat-rate.field.valid_from']}
					value={entry.valid_from}
				/>
			</ViewSection>

			<ViewSection title={translations['vat-rate.section.other']}>
				<ViewField
					label={translations['vat-rate.field.notes']}
					value={entry.notes}
					full
				/>
			</ViewSection>

			<ViewSection title={translations['vat-rate.section.timestamps']}>
				<ViewField
					label={translations['vat-rate.field.created_at']}
					value={formatDate(entry.created_at, 'date-time')}
				/>
				<ViewField
					label={translations['vat-rate.field.updated_at']}
					value={formatDate(entry.updated_at, 'date-time')}
				/>
			</ViewSection>
		</div>
	);
}
