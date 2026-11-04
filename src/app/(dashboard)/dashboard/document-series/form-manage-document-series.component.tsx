'use client';

import { useMemo } from 'react';
import {
	FormComponentInput,
	FormComponentSelect,
	FormComponentTextarea,
} from '@/components/form/form-element.component';
import {
	enumTranslationKeys,
	replaceVars,
	translateEnumLabel,
} from '@/helpers/string.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useTranslation } from '@/hooks/use-translation.hook';
import {
	DOCUMENT_SERIES_CODE_MAX_CHARS,
	type DocumentType,
	DocumentTypeEnum,
} from '@/models/document-series.model';
import { useWindowForm } from '@/providers/window-form.provider';

const TRANSLATION_KEYS = [
	'document-series.text.label_code_max',
	'document-series.field.document_type',
	'document-series.field.notes',
	'document-series.field.start_number',
	'document-series.text.placeholder_code',
	...enumTranslationKeys(
		'document-series.enum.document_type',
		DocumentTypeEnum,
	),
] as const;

export type DocumentSeriesFormValuesType = {
	document_type: DocumentType | null;
	code: string | null;
	start_number: number | null;
	notes: string | null;
};

export function FormManageDocumentSeries() {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const documentTypes = useMemo(
		() =>
			Object.values(DocumentTypeEnum).map((value) => ({
				label: translateEnumLabel(
					translations,
					'document-series.enum.document_type',
					value,
				),
				value,
			})),
		[translations],
	);

	const { formOperation, formValues, errors, handleChange, pending } =
		useWindowForm<DocumentSeriesFormValuesType>();

	const elementIds = useElementIds([
		'documentType',
		'code',
		'startNumber',
		'notes',
	] as const);

	/*
	 * The document type is the key the counter is stored under, so the backend's update
	 * payload has no slot for it - editing it would move already-issued numbers to another
	 * series. The field is shown on update for context but stays disabled, which also keeps
	 * its hidden input out of the submitted `FormData`.
	 */
	const isDocumentTypeEditable = formOperation === 'create';

	return (
		<>
			<FormComponentSelect<DocumentSeriesFormValuesType>
				labelText={translations['document-series.field.document_type']}
				id={elementIds.documentType}
				fieldName="document_type"
				fieldValue={formValues.document_type}
				options={documentTypes}
				isRequired={true}
				disabled={pending || !isDocumentTypeEditable}
				onChange={(value) =>
					handleChange('document_type', value as DocumentType)
				}
				error={errors.document_type}
			/>

			<FormComponentInput<DocumentSeriesFormValuesType>
				labelText={replaceVars(
					translations['document-series.text.label_code_max'],
					{
						max: DOCUMENT_SERIES_CODE_MAX_CHARS,
					},
				)}
				id={elementIds.code}
				fieldName="code"
				fieldValue={formValues.code ?? ''}
				isRequired={true}
				placeholderText={
					translations['document-series.text.placeholder_code']
				}
				disabled={pending}
				onChange={(e) => handleChange('code', e.target.value)}
				error={errors.code}
			/>

			<FormComponentInput<DocumentSeriesFormValuesType>
				labelText={translations['document-series.field.start_number']}
				id={elementIds.startNumber}
				fieldName="start_number"
				fieldType="number"
				fieldValue={formValues.start_number ?? null}
				isRequired={true}
				disabled={pending}
				onChange={(e) =>
					handleChange(
						'start_number',
						e.target.value === '' ? null : Number(e.target.value),
					)
				}
				error={errors.start_number}
			/>

			<FormComponentTextarea<DocumentSeriesFormValuesType>
				labelText={translations['document-series.field.notes']}
				id={elementIds.notes}
				fieldName="notes"
				fieldValue={formValues.notes ?? ''}
				rows={3}
				disabled={pending}
				onChange={(e) => handleChange('notes', e.target.value)}
				error={errors.notes}
			/>
		</>
	);
}
