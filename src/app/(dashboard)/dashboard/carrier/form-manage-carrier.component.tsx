'use client';

import {
	FormComponentInput,
	FormComponentTextarea,
} from '@/components/form/form-element.component';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useTranslation } from '@/hooks/use-translation.hook';
import { useWindowForm } from '@/providers/window-form.provider';

const TRANSLATION_KEYS = [
	'carrier.field.email',
	'carrier.field.name',
	'carrier.field.notes',
	'carrier.field.phone',
	'carrier.field.website',
	'carrier.text.placeholder_email',
	'carrier.text.placeholder_name',
	'carrier.text.placeholder_phone',
	'carrier.text.placeholder_website',
] as const;

export type CarrierFormValuesType = {
	name: string | null;
	website: string | null;
	phone: string | null;
	email: string | null;
	notes: string | null;
};

export function FormManageCarrier() {
	const { translations } = useTranslation(TRANSLATION_KEYS);

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
				labelText={translations['carrier.field.name']}
				id={elementIds.name}
				fieldName="name"
				fieldValue={formValues.name ?? ''}
				isRequired={true}
				placeholderText={translations['carrier.text.placeholder_name']}
				disabled={pending}
				onChange={(e) => handleChange('name', e.target.value)}
				error={errors.name}
			/>

			<FormComponentInput<CarrierFormValuesType>
				labelText={translations['carrier.field.website']}
				id={elementIds.website}
				fieldName="website"
				fieldValue={formValues.website ?? ''}
				placeholderText={
					translations['carrier.text.placeholder_website']
				}
				disabled={pending}
				onChange={(e) => handleChange('website', e.target.value)}
				error={errors.website}
			/>

			<FormComponentInput<CarrierFormValuesType>
				labelText={translations['carrier.field.phone']}
				id={elementIds.phone}
				fieldName="phone"
				fieldValue={formValues.phone ?? ''}
				placeholderText={translations['carrier.text.placeholder_phone']}
				disabled={pending}
				onChange={(e) => handleChange('phone', e.target.value)}
				error={errors.phone}
			/>

			<FormComponentInput<CarrierFormValuesType>
				labelText={translations['carrier.field.email']}
				id={elementIds.email}
				fieldName="email"
				fieldType="email"
				fieldValue={formValues.email ?? ''}
				placeholderText={translations['carrier.text.placeholder_email']}
				disabled={pending}
				onChange={(e) => handleChange('email', e.target.value)}
				error={errors.email}
			/>

			<FormComponentTextarea<CarrierFormValuesType>
				labelText={translations['carrier.field.notes']}
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
