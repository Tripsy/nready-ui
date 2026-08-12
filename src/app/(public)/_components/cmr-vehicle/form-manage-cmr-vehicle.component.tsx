import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import {
	FormComponentAutoComplete,
	FormComponentInput,
} from '@/components/form/form-element.component';
import { Icons } from '@/components/icon.component';
import { requestFind } from '@/helpers/services.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useRemoteAutocomplete } from '@/hooks/use-remote-autocomplete';
import { useTranslation } from '@/hooks/use-translation.hook';
import {
	displayVehicleLabel,
	type VehicleModel,
	VehicleTypeEnum,
} from '@/models/vehicle.model';
import { useWindowForm } from '@/providers/window-form.provider';
import { useModalStore } from '@/stores/window.store';
import type { FindFunctionResponseType } from '@/types/action.type';
import { DataSourceSectionEnum } from '@/types/data-source.type';

export type CmrVehicleFormValuesType = {
	cmr_id: number | null;
	vehicle_id: number | null;
	vehicle: string | null;
	license_plate: string | null;
	vin: string | null;
	notes: string | null;
};

const TRANSLATION_KEYS = [
	'cmr-vehicle.field.vehicle',
	'cmr-vehicle.field.vin',
	'cmr-vehicle.field.license_plate',
	'cmr-vehicle.field.notes',
] as const;

export function FormManageCmrVehicle() {
	const { formValues, errors, handleChange, pending } =
		useWindowForm<CmrVehicleFormValuesType>();

	const { translations } = useTranslation(TRANSLATION_KEYS);

	const queryClient = useQueryClient();

	const { open, focus, getCurrentWindow } = useModalStore();

	const windowConfig = getCurrentWindow();

	const elementIds = useElementIds([
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
						filter: {
							term: q,
						},
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
			<input
				type="hidden"
				name="cmr_id"
				value={formValues.cmr_id ?? ''}
			/>

			<input
				type="hidden"
				name="vehicle_id"
				value={formValues.vehicle_id ?? ''}
			/>

			<FormComponentAutoComplete<CmrVehicleFormValuesType, VehicleModel>
				labelText={translations['cmr-vehicle.field.vehicle']}
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
						handleChange('vehicle', displayVehicleLabel(m));
						handleChange('vehicle_id', m.id);
					},
					getOptionLabel: (m) => displayVehicleLabel(m),
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

			<FormComponentInput<CmrVehicleFormValuesType>
				labelText={translations['cmr-vehicle.field.vin']}
				id={elementIds.vin}
				fieldName="vin"
				fieldValue={formValues.vin ?? ''}
				isRequired={true}
				placeholderText="e.g.: 1FABP34A5DF123456"
				disabled={pending}
				onChange={(e) => handleChange('vin', e.target.value)}
				error={errors.vin}
			/>

			<FormComponentInput<CmrVehicleFormValuesType>
				labelText={translations['cmr-vehicle.field.license_plate']}
				id={elementIds.license_plate}
				fieldName="license_plate"
				fieldValue={formValues.license_plate ?? ''}
				placeholderText="e.g.: B-123-ABC"
				disabled={pending}
				onChange={(e) => handleChange('license_plate', e.target.value)}
				error={errors.license_plate}
			/>

			<FormComponentInput<CmrVehicleFormValuesType>
				labelText={translations['cmr-vehicle.field.notes']}
				id={elementIds.notes}
				fieldName="notes"
				fieldValue={formValues.notes ?? ''}
				placeholderText="e.g.: The car doesn't have wheels"
				disabled={pending}
				onChange={(e) => handleChange('notes', e.target.value)}
				error={errors.notes}
			/>
		</>
	);
}
