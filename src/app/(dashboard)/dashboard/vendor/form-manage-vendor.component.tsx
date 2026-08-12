import {
	FormComponentInput,
	FormComponentRadio,
} from '@/components/form/form-element.component';
import { toOptionsFromEnum } from '@/helpers/form.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { type VendorType, VendorTypeEnum } from '@/models/vendor.model';
import { useWindowForm } from '@/providers/window-form.provider';

export type VendorFormValuesType = {
	name: string | null;
	type: VendorType;
};

const vendorTypes = toOptionsFromEnum(VendorTypeEnum, {
	formatter: formatEnumLabel,
});

export function FormManageVendor() {
	const { formValues, errors, handleChange, pending } =
		useWindowForm<VendorFormValuesType>();

	const elementIds = useElementIds(['name', 'type'] as const);

	return (
		<>
			<FormComponentRadio<VendorFormValuesType>
				labelText="Type"
				id={elementIds.type}
				fieldName="type"
				fieldValue={formValues.type}
				options={vendorTypes}
				disabled={pending}
				onChange={(value) => handleChange('type', value as VendorType)}
				error={errors.type}
			/>

			<FormComponentInput<VendorFormValuesType>
				labelText="Name"
				id={elementIds.name}
				fieldName="name"
				fieldValue={formValues.name ?? ''}
				isRequired={true}
				placeholderText="e.g.: Petrom"
				disabled={pending}
				onChange={(e) => handleChange('name', e.target.value)}
				error={errors.name}
			/>
		</>
	);
}
