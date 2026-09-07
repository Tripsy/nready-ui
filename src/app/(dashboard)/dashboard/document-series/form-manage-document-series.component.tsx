import {
	FormComponentInput,
	FormComponentSelect,
	FormComponentTextarea,
} from '@/components/form/form-element.component';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import {
	DOCUMENT_SERIES_CODE_MAX_CHARS,
	type DocumentType,
	DocumentTypeEnum,
	DocumentTypeLabels,
} from '@/models/document-series.model';
import { useWindowForm } from '@/providers/window-form.provider';

export type DocumentSeriesFormValuesType = {
	document_type: DocumentType | null;
	code: string | null;
	start_number: number | null;
	notes: string | null;
};

const documentTypes = Object.values(DocumentTypeEnum).map((value) => ({
	label: DocumentTypeLabels[value],
	value,
}));

export function FormManageDocumentSeries() {
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
				labelText="Document type"
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
				labelText={`Code (max ${DOCUMENT_SERIES_CODE_MAX_CHARS} characters)`}
				id={elementIds.code}
				fieldName="code"
				fieldValue={formValues.code ?? ''}
				isRequired={true}
				placeholderText="e.g.: INV"
				disabled={pending}
				onChange={(e) => handleChange('code', e.target.value)}
				error={errors.code}
			/>

			<FormComponentInput<DocumentSeriesFormValuesType>
				labelText="Start number"
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
				labelText="Notes"
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
