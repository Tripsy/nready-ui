import {
	FormComponentInput,
	FormComponentTextarea,
} from '@/components/form/form-element.component';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useWindowForm } from '@/providers/window-form.provider';

export type CarrierFormValuesType = {
	name: string | null;
	website: string | null;
	phone: string | null;
	email: string | null;
	notes: string | null;
};

export function FormManageCarrier() {
	const { formValues, errors, handleChange, pending } =
		useWindowForm<CarrierFormValuesType>();

	const elementIds = useElementIds([
		'name',
		'website',
		'phone',
		'email',
		'notes',
	] as const);

	return (
		<>
			<FormComponentInput<CarrierFormValuesType>
				labelText="Name"
				id={elementIds.name}
				fieldName="name"
				fieldValue={formValues.name ?? ''}
				isRequired={true}
				placeholderText="e.g.: Fan Courier"
				disabled={pending}
				onChange={(e) => handleChange('name', e.target.value)}
				error={errors.name}
			/>

			<FormComponentInput<CarrierFormValuesType>
				labelText="Website"
				id={elementIds.website}
				fieldName="website"
				fieldValue={formValues.website ?? ''}
				placeholderText="e.g.: https://www.fancourier.ro"
				disabled={pending}
				onChange={(e) => handleChange('website', e.target.value)}
				error={errors.website}
			/>

			<FormComponentInput<CarrierFormValuesType>
				labelText="Phone"
				id={elementIds.phone}
				fieldName="phone"
				fieldValue={formValues.phone ?? ''}
				placeholderText="e.g.: +40 721 000 000"
				disabled={pending}
				onChange={(e) => handleChange('phone', e.target.value)}
				error={errors.phone}
			/>

			<FormComponentInput<CarrierFormValuesType>
				labelText="Email"
				id={elementIds.email}
				fieldName="email"
				fieldType="email"
				fieldValue={formValues.email ?? ''}
				placeholderText="e.g.: office@fancourier.ro"
				disabled={pending}
				onChange={(e) => handleChange('email', e.target.value)}
				error={errors.email}
			/>

			<FormComponentTextarea<CarrierFormValuesType>
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
