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
	type ExchangeRateModel,
	ExchangeRateSourceEnum,
} from '@/models/exchange-rate.model';

const TRANSLATION_KEYS = [
	'exchange-rate.field.base_currency',
	'exchange-rate.field.created_at',
	'exchange-rate.field.currency',
	'exchange-rate.field.id',
	'exchange-rate.field.notes',
	'exchange-rate.field.provider',
	'exchange-rate.field.rate',
	'exchange-rate.field.rate_date',
	'exchange-rate.field.source',
	'exchange-rate.field.updated_at',
	'exchange-rate.section.origin',
	'exchange-rate.section.other',
	'exchange-rate.section.rate',
	'exchange-rate.section.timestamps',
	...enumTranslationKeys('exchange-rate.enum.source', ExchangeRateSourceEnum),
] as const;

export function ViewExchangeRate({ entry }: { entry: ExchangeRateModel }) {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">
					{translations['exchange-rate.field.id']}
				</span>{' '}
				{entry.id}
				<span className="ml-2">
					{/* The row in words, which is the only way the direction reads
					    unambiguously */}
					1 {entry.currency} = {entry.rate} {entry.base_currency}
				</span>
			</div>

			<ViewSection title={translations['exchange-rate.section.rate']}>
				<ViewField
					label={translations['exchange-rate.field.currency']}
					value={entry.currency}
				/>
				<ViewField
					label={translations['exchange-rate.field.base_currency']}
					value={entry.base_currency}
				/>
				<ViewField
					label={translations['exchange-rate.field.rate']}
					value={String(entry.rate)}
				/>
				<ViewField
					label={translations['exchange-rate.field.rate_date']}
					value={entry.rate_date}
				/>
			</ViewSection>

			<ViewSection title={translations['exchange-rate.section.origin']}>
				{/* A manual row is never written over by the daily import; an imported one is */}
				<ViewField
					label={translations['exchange-rate.field.source']}
					value={translateEnumLabel(
						translations,
						'exchange-rate.enum.source',
						entry.source,
					)}
				/>
				<ViewField
					label={translations['exchange-rate.field.provider']}
					value={entry.provider}
				/>
			</ViewSection>

			<ViewSection title={translations['exchange-rate.section.other']}>
				<ViewField
					label={translations['exchange-rate.field.notes']}
					value={entry.notes}
					full
				/>
			</ViewSection>

			<ViewSection
				title={translations['exchange-rate.section.timestamps']}
			>
				<ViewField
					label={translations['exchange-rate.field.created_at']}
					value={formatDate(entry.created_at, 'date-time')}
				/>
				<ViewField
					label={translations['exchange-rate.field.updated_at']}
					value={formatDate(entry.updated_at, 'date-time')}
				/>
			</ViewSection>
		</div>
	);
}
