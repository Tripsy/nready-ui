import {
	FormComponentCalendar,
	FormComponentTextarea,
} from '@/components/form/form-element.component';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useWindowForm } from '@/providers/window-form.provider';

export type InvoiceUpdateFormValuesType = {
	due_at: string | null;
	notes: string | null;
};

/**
 * What a draft still accepts. The figures are not here: they come from the lines, and the
 * currency cannot move at all - every stored amount is quoted in it.
 */
export function FormUpdateInvoice() {
	const { formValues, errors, handleChange, pending } =
		useWindowForm<InvoiceUpdateFormValuesType>();

	const elementIds = useElementIds(['dueAt', 'notes'] as const);

	return (
		<>
			<FormComponentCalendar<InvoiceUpdateFormValuesType>
				labelText="Due At"
				id={elementIds.dueAt}
				fieldName="due_at"
				fieldValue={formValues.due_at ?? ''}
				placeholderText="-select-"
				disabled={pending}
				onSelect={(value) =>
					handleChange('due_at', value === '' ? null : value)
				}
				error={errors.due_at}
			/>

			<FormComponentTextarea<InvoiceUpdateFormValuesType>
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
