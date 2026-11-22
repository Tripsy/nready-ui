'use client';

import { useMemo } from 'react';
import {
	FormComponentInput,
	FormComponentRadio,
} from '@/components/form/form-element.component';
import { toOptionsFromEnum } from '@/helpers/form.helper';
import {
	enumTranslationKeys,
	translateEnumLabel,
} from '@/helpers/string.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useTranslation } from '@/hooks/use-translation.hook';
import { type VendorType, VendorTypeEnum } from '@/models/vendor.model';
import { useWindowForm } from '@/providers/window-form.provider';

const TRANSLATION_KEYS = [
	'vendor.field.name',
	'vendor.field.type',
	'vendor.text.placeholder_name',
	...enumTranslationKeys('vendor.enum.type', VendorTypeEnum),
] as const;

export type VendorFormValuesType = {
	name: string | null;
	type: VendorType;
};

export function FormManageVendor() {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const vendorTypes = useMemo(
		() =>
			toOptionsFromEnum(VendorTypeEnum, {
				formatter: (value) =>
					translateEnumLabel(translations, 'vendor.enum.type', value),
			}),
		[translations],
	);

	const { formValues, errors, handleChange, pending } =
		useWindowForm<VendorFormValuesType>();

	const elementIds = useElementIds(['name', 'type'] as const);

	return (
		<>
			<FormComponentRadio<VendorFormValuesType>
				labelText={translations['vendor.field.type']}
				id={elementIds.type}
				fieldName="type"
				fieldValue={formValues.type}
				options={vendorTypes}
				disabled={pending}
				onChange={(value) => handleChange('type', value as VendorType)}
				error={errors.type}
			/>

			<FormComponentInput<VendorFormValuesType>
				labelText={translations['vendor.field.name']}
				id={elementIds.name}
				fieldName="name"
				fieldValue={formValues.name ?? ''}
				isRequired={true}
				placeholderText={translations['vendor.text.placeholder_name']}
				disabled={pending}
				onChange={(e) => handleChange('name', e.target.value)}
				error={errors.name}
			/>
		</>
	);
}
