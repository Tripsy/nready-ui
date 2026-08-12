import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import {
	FormComponentAutoComplete,
	FormComponentInput,
	FormComponentRadio,
} from '@/components/form/form-element.component';
import { Icons } from '@/components/icon.component';
import { toOptionsFromEnum } from '@/helpers/form.helper';
import { requestFind } from '@/helpers/services.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useRemoteAutocomplete } from '@/hooks/use-remote-autocomplete';
import { type BrandModel, BrandTypeEnum } from '@/models/brand.model';
import { type VehicleType, VehicleTypeEnum } from '@/models/vehicle.model';
import { useWindowForm } from '@/providers/window-form.provider';
import { useModalStore } from '@/stores/window.store';
import type { FindFunctionResponseType } from '@/types/action.type';
import { DataSourceSectionEnum } from '@/types/data-source.type';

export type VehicleFormValuesType = {
	brand_id: number | null;
	brand: string | null;
	vehicle_type: VehicleType;
	model: string | null;
	length: number | null;
	width: number | null;
	height: number | null;
	weight: number | null;
};

const vehicleTypes = toOptionsFromEnum(VehicleTypeEnum, {
	formatter: formatEnumLabel,
});

export function FormManageVehicle() {
	const { formValues, errors, handleChange, pending } =
		useWindowForm<VehicleFormValuesType>();

	const queryClient = useQueryClient();

	const { open, focus, getCurrentWindow } = useModalStore();

	const windowConfig = getCurrentWindow();

	const elementIds = useElementIds([
		'vehicle_type',
		'brand',
		'model',
		'length',
		'width',
		'height',
		'weight',
	] as const);

	const [searchBrand, setSearchBrand] = useState('');

	const { suggestions: brandSuggestions, isFetching: isBrandFetching } =
		useRemoteAutocomplete<BrandModel>({
			query: searchBrand,
			queryKey: ['s-brand'],
			queryFn: async (q) => {
				const res: FindFunctionResponseType<BrandModel> | undefined =
					await requestFind('brand', {
						filter: { term: q },
						limit: 10,
					});

				return res?.entries ?? [];
			},
			minLength: 3,
		});

	const invalidateBrandSuggestions = useCallback(
		() =>
			queryClient.invalidateQueries({
				queryKey: ['s-brand'],
			}),
		[queryClient],
	);

	return (
		<>
			<FormComponentRadio<VehicleFormValuesType>
				labelText="Vehicle Type"
				id={elementIds.vehicle_type}
				fieldName="vehicle_type"
				fieldValue={formValues.vehicle_type}
				options={vehicleTypes}
				disabled={pending}
				onChange={(value) =>
					handleChange('vehicle_type', value as VehicleType)
				}
				error={errors.vehicle_type}
			/>

			<input
				type="hidden"
				name="brand_id"
				value={formValues.brand_id ?? ''}
			/>

			<FormComponentAutoComplete<VehicleFormValuesType, BrandModel>
				labelText="Brand"
				id={elementIds.brand}
				fieldName="brand"
				fieldValue={formValues.brand ?? ''}
				className="pl-8"
				isRequired={true}
				disabled={pending}
				error={errors.brand}
				onInputChange={(value) => {
					handleChange('brand', value);
					handleChange('brand_id', null);
					setSearchBrand(value);
				}}
				autoCompleteProps={{
					suggestions: brandSuggestions,
					isLoading: isBrandFetching,
					onSelect: (m) => {
						handleChange('brand', m.name);
						handleChange('brand_id', m.id);
					},
					getOptionLabel: (m) => m.name,
					getOptionKey: (m) => m.id,

					allowCreate: true,

					onCreate: (value) => {
						open({
							section: DataSourceSectionEnum.DASHBOARD,
							dataSource: 'brand',
							action: 'create',
							minimized: false,
							data: {
								prefillEntry: {
									brand_type: BrandTypeEnum.VEHICLE,
									name: value,
								},
							},
							events: {
								success: async (brand?: BrandModel) => {
									if (!brand) {
										return;
									}

									handleChange('brand', brand.name);
									handleChange('brand_id', brand.id);

									await invalidateBrandSuggestions();

									// Back to vehicle form
									if (windowConfig) {
										focus(windowConfig.uid);
									}
								},
							},
							props: {
								size: 'x2l',
							},
						});
					},
					createLabel: (value) => `Create brand "${value}"`,
				}}
				icons={{
					left: <Icons.Brand className="opacity-40 h-4.5 w-4.5" />,
				}}
			/>

			<FormComponentInput<VehicleFormValuesType>
				labelText="Model"
				id={elementIds.model}
				fieldName="model"
				fieldValue={formValues.model ?? ''}
				isRequired={true}
				placeholderText="e.g.: Logan"
				disabled={pending}
				onChange={(e) => handleChange('model', e.target.value)}
				error={errors.model}
			/>

			<div className="flex flex-wrap gap-2">
				<FormComponentInput<VehicleFormValuesType>
					labelText="Length (mm)"
					id={elementIds.length}
					fieldName="length"
					fieldType="number"
					fieldValue={formValues.length ?? null}
					disabled={pending}
					onChange={(e) =>
						handleChange(
							'length',
							e.target.value === ''
								? null
								: Number(e.target.value),
						)
					}
					error={errors.length}
				/>
				<FormComponentInput<VehicleFormValuesType>
					labelText="Width (mm)"
					id={elementIds.width}
					fieldName="width"
					fieldType="number"
					fieldValue={formValues.width ?? null}
					disabled={pending}
					onChange={(e) =>
						handleChange(
							'width',
							e.target.value === ''
								? null
								: Number(e.target.value),
						)
					}
					error={errors.width}
				/>
			</div>
			<div className="flex flex-wrap gap-2">
				<FormComponentInput<VehicleFormValuesType>
					labelText="Height (mm)"
					id={elementIds.height}
					fieldName="height"
					fieldType="number"
					fieldValue={formValues.height ?? null}
					disabled={pending}
					onChange={(e) =>
						handleChange(
							'height',
							e.target.value === ''
								? null
								: Number(e.target.value),
						)
					}
					error={errors.height}
				/>
				<FormComponentInput<VehicleFormValuesType>
					labelText="Weight (kg)"
					id={elementIds.weight}
					fieldName="weight"
					fieldType="number"
					fieldValue={formValues.weight ?? null}
					disabled={pending}
					onChange={(e) =>
						handleChange(
							'weight',
							e.target.value === ''
								? null
								: Number(e.target.value),
						)
					}
					error={errors.weight}
				/>
			</div>
		</>
	);
}
