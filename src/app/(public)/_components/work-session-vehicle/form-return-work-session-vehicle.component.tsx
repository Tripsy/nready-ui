import { FormComponentInput } from '@/components/form/form-element.component';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useTranslation } from '@/hooks/use-translation.hook';
import { type VehicleType, VehicleTypeEnum } from '@/models/vehicle.model';
import { useAuth } from '@/providers/auth.provider';
import { useWindowForm } from '@/providers/window-form.provider';
import { useModalStore } from '@/stores/window.store';

export type WorkSessionVehicleFormReturnValuesType = {
	vehicle_type: VehicleType | null;

	vehicle_km_end: number | null;

	notes: string | null;
};

const TRANSLATION_KEYS = [
	'work-session-vehicle.field.km_end',
	'work-session-vehicle.field.notes',
] as const;

export function FormReturnWorkSessionVehicle() {
	const { auth } = useAuth();
	const { getCurrentWindow, close } = useModalStore();

	const windowConfig = getCurrentWindow();

	const { formValues, errors, handleChange, pending } =
		useWindowForm<WorkSessionVehicleFormReturnValuesType>();

	const { translations } = useTranslation(TRANSLATION_KEYS);

	const elementIds = useElementIds(['vehicle_km_end', 'notes'] as const);

	if (!auth) {
		close(windowConfig?.uid);

		return null;
	}

	return (
		<>
			<input
				type="hidden"
				name="vehicle_type"
				value={formValues.vehicle_type ?? ''}
			/>

			{formValues.vehicle_type !== VehicleTypeEnum.TRAILER && (
				<FormComponentInput<WorkSessionVehicleFormReturnValuesType>
					labelText={
						translations['work-session-vehicle.field.km_end']
					}
					id={elementIds.vehicle_km_end}
					fieldName="vehicle_km_end"
					fieldType="number"
					fieldValue={formValues.vehicle_km_end ?? null}
					disabled={pending}
					onChange={(e) =>
						handleChange(
							'vehicle_km_end',
							e.target.value === ''
								? null
								: Number(e.target.value),
						)
					}
					error={errors.vehicle_km_end}
				/>
			)}

			<FormComponentInput<WorkSessionVehicleFormReturnValuesType>
				labelText={translations['work-session-vehicle.field.notes']}
				id={elementIds.notes}
				fieldName="notes"
				fieldValue={formValues.notes ?? ''}
				disabled={pending}
				onChange={(e) => handleChange('notes', e.target.value)}
				error={errors.notes}
			/>
		</>
	);
}
