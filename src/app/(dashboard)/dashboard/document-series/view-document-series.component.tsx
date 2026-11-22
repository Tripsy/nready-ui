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
	type DocumentSeriesModel,
	DocumentTypeEnum,
} from '@/models/document-series.model';

const TRANSLATION_KEYS = [
	'document-series.field.code',
	'document-series.field.created_at',
	'document-series.field.id',
	'document-series.field.next_number',
	'document-series.field.notes',
	'document-series.field.start_number',
	'document-series.field.updated_at',
	'document-series.section.other',
	'document-series.section.series',
	'document-series.section.timestamps',
	...enumTranslationKeys(
		'document-series.enum.document_type',
		DocumentTypeEnum,
	),
] as const;

export function ViewDocumentSeries({ entry }: { entry: DocumentSeriesModel }) {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">
					{translations['document-series.field.id']}
				</span>{' '}
				{entry.id}
				<span className="ml-2">
					{translateEnumLabel(
						translations,
						'document-series.enum.document_type',
						entry.document_type,
					)}
				</span>
			</div>

			<ViewSection title={translations['document-series.section.series']}>
				<ViewField
					label={translations['document-series.field.code']}
					value={entry.code}
				/>
				<ViewField
					label={translations['document-series.field.start_number']}
					value={String(entry.start_number)}
				/>
				{/* The counter only ever moves through an allocation, so this is the number the
				    next document issued against this series will carry. */}
				<ViewField
					label={translations['document-series.field.next_number']}
					value={String(entry.next_number)}
				/>
			</ViewSection>

			<ViewSection title={translations['document-series.section.other']}>
				<ViewField
					label={translations['document-series.field.notes']}
					value={entry.notes}
					full
				/>
			</ViewSection>

			<ViewSection
				title={translations['document-series.section.timestamps']}
			>
				<ViewField
					label={translations['document-series.field.created_at']}
					value={formatDate(entry.created_at, 'date-time')}
				/>
				<ViewField
					label={translations['document-series.field.updated_at']}
					value={formatDate(entry.updated_at, 'date-time')}
				/>
			</ViewSection>
		</div>
	);
}
