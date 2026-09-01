'use client';

import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { formatDate } from '@/helpers/date.helper';
import {
	type ExchangeRateModel,
	ExchangeRateSourceLabels,
} from '@/models/exchange-rate.model';

export function ViewExchangeRate({ entry }: { entry: ExchangeRateModel }) {
	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">ID</span> {entry.id}
				<span className="ml-2">
					{/* The row in words, which is the only way the direction reads
					    unambiguously */}
					1 {entry.currency} = {entry.rate} {entry.base_currency}
				</span>
			</div>

			<ViewSection title="Rate">
				<ViewField label="Currency" value={entry.currency} />
				<ViewField label="Base currency" value={entry.base_currency} />
				<ViewField label="Rate" value={String(entry.rate)} />
				<ViewField label="Rate date" value={entry.rate_date} />
			</ViewSection>

			<ViewSection title="Origin">
				{/* A manual row is never written over by the daily import; an imported one is */}
				<ViewField
					label="Source"
					value={ExchangeRateSourceLabels[entry.source]}
				/>
				<ViewField label="Provider" value={entry.provider} />
			</ViewSection>

			<ViewSection title="Other">
				<ViewField label="Notes" value={entry.notes} full />
			</ViewSection>

			<ViewSection title="Timestamps">
				<ViewField
					label="Created At"
					value={formatDate(entry.created_at, 'date-time')}
				/>
				<ViewField
					label="Updated At"
					value={formatDate(entry.updated_at, 'date-time')}
				/>
			</ViewSection>
		</div>
	);
}
