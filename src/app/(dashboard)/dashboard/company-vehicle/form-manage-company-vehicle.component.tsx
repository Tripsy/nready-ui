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
import {
	type CompanyVehicleScope,
	CompanyVehicleScopeEnum,
} from '@/models/company-vehicle.model';
import { type VehicleModel, VehicleTypeEnum } from '@/models/vehicle.model';
import { useWindowForm } from '@/providers/window-form.provider';
import { useModalStore } from '@/stores/window.store';
import type { FindFunctionResponseType } from '@/types/action.type';
import { DataSourceSectionEnum } from '@/types/data-source.type';

export type CompanyVehicleFormValuesType = {
	vehicle_id: number | null;
	vehicle: string | null;
	scope: CompanyVehicleScope;
	license_plate: string | null;
	vin: string | null;
	notes: string | null;
};

const scopes = toOptionsFromEnum(CompanyVehicleScopeEnum, {
	formatter: formatEnumLabel,
});

export function FormManageCompanyVehicle() {
	const { formValues, errors, handleChange, pending } =
		useWindowForm<CompanyVehicleFormValuesType>();

	const queryClient = useQueryClient();

	const { open, focus, getCurrentWindow } = useModalStore();

	const windowConfig = getCurrentWindow();

	const elementIds = useElementIds([
		'scope',
		'vehicle',
		'license_plate',
		'vin',
		'notes',
	] as const);

	const [searchVehicle, setSearchVehicle] = useState('');

	const { suggestions: vehicleSuggestions, isFetching: isVehicleFetching } =
		useRemoteAutocomplete<VehicleModel>({
			query: searchVehicle,
			queryKey: ['s-vehicle'],
			queryFn: async (q) => {
				const res: FindFunctionResponseType<VehicleModel> | undefined =
					await requestFind('vehicle', {
						filter: { term: q },
						limit: 10,
					});

				return res?.entries ?? [];
			},
			minLength: 2,
		});

	const invalidateVehicleSuggestions = useCallback(
		() =>
			queryClient.invalidateQueries({
				queryKey: ['s-vehicle'],
			}),
		[queryClient],
	);

	return (
		<>
			<FormComponentRadio<CompanyVehicleFormValuesType>
				labelText="Vehicle Scope"
				id={elementIds.scope}
				fieldName="scope"
				fieldValue={formValues.scope}
				options={scopes}
				disabled={pending}
				onChange={(value) =>
					handleChange('scope', value as CompanyVehicleScope)
				}
				error={errors.scope}
			/>

			<input
				type="hidden"
				name="vehicle_id"
				value={formValues.vehicle_id ?? ''}
			/>

			<FormComponentAutoComplete<
				CompanyVehicleFormValuesType,
				VehicleModel
			>
				labelText="Vehicle"
				id={elementIds.vehicle}
				fieldName="vehicle"
				fieldValue={formValues.vehicle ?? ''}
				className="pl-8"
				isRequired={true}
				disabled={pending}
				error={errors.vehicle}
				onInputChange={(value) => {
					handleChange('vehicle', value);
					handleChange('vehicle_id', null);
					setSearchVehicle(value);
				}}
				autoCompleteProps={{
					suggestions: vehicleSuggestions,
					isLoading: isVehicleFetching,
					onSelect: (m) => {
						handleChange('vehicle', m.model);
						handleChange('vehicle_id', m.id);
					},
					getOptionLabel: (m) => m.model,
					getOptionKey: (m) => m.id,

					allowCreate: true,

					onCreate: (value) => {
						open({
							section: DataSourceSectionEnum.DASHBOARD,
							dataSource: 'vehicle',
							action: 'create',
							minimized: false,
							data: {
								prefillEntry: {
									vehicle_type: VehicleTypeEnum.AUTO,
									model: value,
								},
							},
							events: {
								success: async (vehicle?: VehicleModel) => {
									if (!vehicle) {
										return;
									}

									handleChange('vehicle', vehicle.model);
									handleChange('vehicle_id', vehicle.id);

									await invalidateVehicleSuggestions();

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
					createLabel: (value) => `Create vehicle "${value}"`,
				}}
				icons={{
					left: <Icons.Vehicle className="opacity-40 h-4.5 w-4.5" />,
				}}
			/>

			<FormComponentInput<CompanyVehicleFormValuesType>
				labelText="License Plate"
				id={elementIds.license_plate}
				fieldName="license_plate"
				fieldValue={formValues.license_plate ?? ''}
				isRequired={true}
				placeholderText="e.g.: B-123-ABC"
				disabled={pending}
				onChange={(e) => handleChange('license_plate', e.target.value)}
				error={errors.license_plate}
			/>

			<FormComponentInput<CompanyVehicleFormValuesType>
				labelText="VIN"
				id={elementIds.vin}
				fieldName="vin"
				fieldValue={formValues.vin ?? ''}
				placeholderText="e.g.: 1FABP34A5DF123456"
				disabled={pending}
				onChange={(e) => handleChange('vin', e.target.value)}
				error={errors.vin}
			/>

			<FormComponentInput<CompanyVehicleFormValuesType>
				labelText="Notes"
				id={elementIds.notes}
				fieldName="notes"
				fieldValue={formValues.notes ?? ''}
				placeholderText="e.g.: Our best car"
				disabled={pending}
				onChange={(e) => handleChange('notes', e.target.value)}
				error={errors.notes}
			/>
		</>
	);
}
