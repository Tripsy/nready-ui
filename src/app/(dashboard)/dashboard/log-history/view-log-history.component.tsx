'use client';

import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { formatDate } from '@/helpers/date.helper';
import {
	enumTranslationKeys,
	parseJson,
	translateEnumLabel,
} from '@/helpers/string.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import {
	LogHistoryActions,
	LogHistoryEntities,
	type LogHistoryModel,
	LogHistorySourceEnum,
} from '@/models/log-history.model';

const TRANSLATION_KEYS = [
	'log-history.field.action',
	'log-history.field.auth_id',
	'log-history.field.entity',
	'log-history.field.entity_id',
	'log-history.field.id',
	'log-history.field.performed_by',
	'log-history.field.recorded_at',
	'log-history.field.request_id',
	'log-history.field.source',
	'log-history.section.info',
	'log-history.section.request_details',
	...enumTranslationKeys('log-history.enum.entity', LogHistoryEntities),
	...enumTranslationKeys('log-history.enum.action', LogHistoryActions),
	...enumTranslationKeys('log-history.enum.source', LogHistorySourceEnum),
] as const;

export function ViewLogHistory({ entry }: { entry: LogHistoryModel }) {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const parsedDetails = parseJson(entry.details);

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">
					{translations['log-history.field.id']}
				</span>{' '}
				{entry.id}
			</div>

			<ViewSection title={translations['log-history.section.info']}>
				<ViewField
					label={translations['log-history.field.request_id']}
					value={entry.request_id}
				/>
				<ViewField
					label={translations['log-history.field.entity']}
					value={translateEnumLabel(
						translations,
						'log-history.enum.entity',
						entry.entity,
					)}
				/>
				<ViewField
					label={translations['log-history.field.entity_id']}
					value={entry.entity_id}
				/>
				<ViewField
					label={translations['log-history.field.action']}
					value={translateEnumLabel(
						translations,
						'log-history.enum.action',
						entry.action,
					)}
				/>
				<ViewField
					label={translations['log-history.field.auth_id']}
					value={entry.auth_id}
				/>
				<ViewField
					label={translations['log-history.field.performed_by']}
					value={entry.performed_by}
				/>
				<ViewField
					label={translations['log-history.field.source']}
					value={translateEnumLabel(
						translations,
						'log-history.enum.source',
						entry.source,
					)}
				/>
				<ViewField
					label={translations['log-history.field.recorded_at']}
					value={formatDate(entry.recorded_at, 'date-time')}
				/>
			</ViewSection>

			{parsedDetails?.request && (
				<ViewSection
					title={translations['log-history.section.request_details']}
				>
					{Object.entries(parsedDetails).map(([key, value]) => (
						<ViewField
							key={key}
							label={key}
							value={
								typeof value === 'object'
									? JSON.stringify(value, null, 2)
									: String(value)
							}
							full
						/>
					))}
				</ViewSection>
			)}
		</div>
	);
}
