import { z } from 'zod';
import { DataTableValue } from '@/app/(dashboard)/_components/data-table-value';
import {
	FormManageVehicle,
	type VehicleFormValuesType,
} from '@/app/(dashboard)/dashboard/vehicle/form-manage-vehicle.component';
import { ViewVehicle } from '@/app/(dashboard)/dashboard/vehicle/view-vehicle.component';
import { translateBatch } from '@/config/translate.setup';
import {
	getFormDataAsEnum,
	getFormDataAsNumber,
	getFormDataAsString,
} from '@/helpers/form.helper';
import { arrayHasValue } from '@/helpers/objects.helper';
import {
	requestCreate,
	requestDelete,
	requestFind,
	requestRestore,
	requestUpdate,
	requestUpdateStatus,
} from '@/helpers/services.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import {
	BaseValidator,
	resolveValidatorMessages,
	sharedValidatorMessages,
} from '@/helpers/validator.helper';
import { type AuthModel, hasPermission } from '@/models/auth.model';
import {
	displayVehicleLabel,
	type VehicleModel,
	type VehicleStatus,
	VehicleStatusEnum,
	type VehicleType,
	VehicleTypeEnum,
} from '@/models/vehicle.model';
import type { FindFunctionParamsType } from '@/types/action.type';
import type {
	DataSourceConfigType,
	DataTableValueOptionsType,
} from '@/types/data-source.type';
import type { FormStateType } from '@/types/form.type';

const validatorMessages = [
	...sharedValidatorMessages,
	'invalid_brand_id',
	'invalid_brand',
	'invalid_vehicle_type',
	'invalid_model',
	'invalid_length',
	'invalid_width',
	'invalid_height',
	'invalid_weight',
] as const;

class VehicleValidator extends BaseValidator<typeof validatorMessages> {
	manage = (isSubmit: boolean = true) =>
		z
			.object({
				brand_id: this.validateId(this.getMessage('invalid_brand_id'), {
					required: false, // Further check is done in superRefine
				}),
				brand: this.validateString(this.getMessage('invalid_brand')),
				vehicle_type: this.validateEnum(
					VehicleTypeEnum,
					this.getMessage('invalid_vehicle_type'),
				),
				model: this.validateString(this.getMessage('invalid_model')),
				length: this.validateNumber(
					{
						invalid: this.getMessage('invalid_length'),
						only_positive: this.getMessage('only_positive'),
					},
					{
						required: false,
					},
				),
				width: this.validateNumber(
					{
						invalid: this.getMessage('invalid_width'),
						only_positive: this.getMessage('only_positive'),
					},
					{
						required: false,
					},
				),
				height: this.validateNumber(
					{
						invalid: this.getMessage('invalid_height'),
						only_positive: this.getMessage('only_positive'),
					},
					{
						required: false,
					},
				),
				weight: this.validateNumber(
					{
						invalid: this.getMessage('invalid_weight'),
						only_positive: this.getMessage('only_positive'),
					},
					{
						required: false,
					},
				),
			})
			.superRefine((data, ctx) => {
				if (isSubmit && data.brand && !data.brand_id) {
					ctx.addIssue({
						path: ['brand'],
						message: this.getMessage('invalid_brand_id'),
						code: 'custom',
					});
				}
			});
}

async function validateForm(
	values: VehicleFormValuesType,
	isSubmit: boolean = true,
) {
	const translations = await resolveValidatorMessages(
		validatorMessages,
		'vehicle',
	);

	const validator = new VehicleValidator(translations);

	return validator.manage(isSubmit).safeParse(values);
}

function getFormValues(formData: FormData): VehicleFormValuesType {
	return {
		brand_id: getFormDataAsNumber(formData, 'brand_id'),
		brand: getFormDataAsString(formData, 'brand'),
		vehicle_type:
			getFormDataAsEnum(formData, 'vehicle_type', VehicleTypeEnum) ||
			VehicleTypeEnum.AUTO,
		model: getFormDataAsString(formData, 'model'),
		length: getFormDataAsNumber(formData, 'length'),
		width: getFormDataAsNumber(formData, 'width'),
		height: getFormDataAsNumber(formData, 'height'),
		weight: getFormDataAsNumber(formData, 'weight'),
	};
}

function getFormState(
	data?: VehicleModel,
): FormStateType<VehicleFormValuesType> {
	return {
		errors: {},
		message: null,
		situation: null,
		values: {
			brand_id: data?.brand?.id ?? null,
			brand: data?.brand ? data?.brand?.name : null,
			vehicle_type: data?.vehicle_type ?? VehicleTypeEnum.AUTO,
			model: data?.model ?? null,
			length: data?.length ?? null,
			width: data?.width ?? null,
			height: data?.height ?? null,
			weight: data?.weight ?? null,
		},
	};
}

export type VehicleDataTableFiltersType = {
	global: { value: string | null; matchMode: 'contains' };
	brand: { value: string | null; matchMode: 'equals' };
	brand_id: { value: number | null; matchMode: 'equals' };
	vehicle_type: { value: VehicleType | null; matchMode: 'equals' };
	status: { value: VehicleStatus | null; matchMode: 'equals' };
	is_deleted: { value: boolean; matchMode: 'equals' };
};

export default async function dataSourceConfig(): Promise<
	DataSourceConfigType<VehicleModel>
> {
	const translations = await translateBatch(
		[
			'create.title',
			'update.title',
			'view.title',
			'delete.title',
			'restore.title',
			'verified.title',
			'draft.title',
		] as const,
		'vehicle.action',
	);

	function displayButtonView(
		auth: AuthModel | null,
	): DataTableValueOptionsType<VehicleModel>['displayButton'] {
		return {
			action: () =>
				hasPermission(auth, 'vehicle', 'read') ? 'view' : undefined,
			dataSource: 'vehicle',
		};
	}

	function displayButtonStatus(
		auth: AuthModel | null,
	): DataTableValueOptionsType<VehicleModel>['displayButton'] {
		return {
			action: (entry: VehicleModel) => {
				if (entry.deleted_at) {
					return hasPermission(auth, 'vehicle', 'delete')
						? 'restore'
						: undefined;
				}

				if (!hasPermission(auth, 'vehicle', 'update')) {
					return undefined;
				}

				return entry.status === VehicleStatusEnum.DRAFT
					? 'verified'
					: 'draft';
			},
		};
	}

	return {
		dataTable: {
			state: {
				first: 0,
				rows: 10,
				sortField: 'id',
				sortOrder: -1 as const,
				filters: {
					global: { value: null, matchMode: 'contains' },
					brand: { value: '', matchMode: 'equals' },
					brand_id: { value: null, matchMode: 'equals' },
					vehicle_type: { value: null, matchMode: 'equals' },
					status: { value: null, matchMode: 'equals' },
					is_deleted: { value: false, matchMode: 'equals' },
				} satisfies VehicleDataTableFiltersType,
			},
			columns: [
				{
					field: 'id',
					header: 'ID',
					defaultWidth: 88,
					sortable: true,
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							markDeleted: true,
							displayButton: displayButtonView(auth),
						}),
				},
				{
					field: 'brand',
					header: 'Brand',
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: entry.brand?.name ?? 'n/a',
						}),
				},
				{
					field: 'model',
					header: 'Model',
					sortable: true,
				},
				{
					field: 'vehicle_type',
					header: 'Type',
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: formatEnumLabel(entry.vehicle_type),
						}),
				},
				{
					field: 'status',
					header: 'Status',
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							dataSource: 'vehicle',
							isStatus: true,
							markDeleted: true,
							displayButton: displayButtonStatus(auth),
						}),
					minWidth: 128,
					maxWidth: 128,
				},
				{
					field: 'created_at',
					header: 'Created At',
					sortable: true,
					body: (entry, column) =>
						DataTableValue(entry, column, {
							displayDate: true,
						}),
				},
			],
			find: (params: FindFunctionParamsType) =>
				requestFind<VehicleModel>('vehicle', params),
		},
		displayEntryLabel: (entry: VehicleModel) => displayVehicleLabel(entry),
		actions: {
			create: {
				windowType: 'form',
				windowTitle: translations['create.title'],
				windowComponent: FormManageVehicle,
				permission: ['vehicle', 'create'],
				entriesSelection: 'free',
				operationFunction: (params: VehicleFormValuesType) =>
					requestCreate<VehicleModel, VehicleFormValuesType>(
						'vehicle',
						params,
					),
				buttonPosition: 'right',
				button: {
					variant: 'default',
				},
				getFormValues: getFormValues,
				validateForm: validateForm,
				getFormState: getFormState,
			},
			update: {
				windowType: 'form',
				windowTitle: translations['update.title'],
				windowComponent: FormManageVehicle,
				permission: ['vehicle', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: VehicleModel) => !entry.deleted_at, // Return true if the entry is not deleted
				operationFunction: (
					params: VehicleFormValuesType,
					id: number,
				) =>
					requestUpdate<VehicleModel, VehicleFormValuesType>(
						'vehicle',
						params,
						id,
					),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'success',
				},
				getFormValues: getFormValues,
				validateForm: validateForm,
				getFormState: getFormState,
			},
			delete: {
				windowType: 'action',
				windowTitle: translations['delete.title'],
				permission: ['vehicle', 'delete'],
				entriesSelection: 'single',
				customEntryCheck: (entry: VehicleModel) => !entry.deleted_at, // Return true if the entry is not deleted
				operationFunction: (entry: VehicleModel) =>
					requestDelete('vehicle', entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
			restore: {
				windowType: 'action',
				windowTitle: translations['restore.title'],
				permission: ['vehicle', 'delete'],
				entriesSelection: 'single',
				customEntryCheck: (entry: VehicleModel) => !!entry.deleted_at, // Return true if the entry is deleted
				operationFunction: (entry: VehicleModel) =>
					requestRestore('vehicle', entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'default',
				},
			},
			verified: {
				windowType: 'action',
				windowTitle: translations['verified.title'],
				permission: ['vehicle', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: VehicleModel) =>
					!entry.deleted_at &&
					arrayHasValue(entry.status, [VehicleStatusEnum.DRAFT]),
				operationFunction: (entry: VehicleModel) =>
					requestUpdateStatus('vehicle', entry, 'verified'),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'default',
				},
			},
			draft: {
				windowType: 'action',
				windowTitle: translations['draft.title'],
				permission: ['vehicle', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: VehicleModel) =>
					!entry.deleted_at &&
					arrayHasValue(entry.status, [VehicleStatusEnum.VERIFIED]),
				operationFunction: (entry: VehicleModel) =>
					requestUpdateStatus('vehicle', entry, 'draft'),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
			view: {
				windowType: 'view',
				windowTitle: translations['view.title'],
				windowComponent: ViewVehicle,
				windowConfigProps: {
					size: 'xl',
				},
				permission: ['vehicle', 'read'],
				entriesSelection: 'single',
				buttonPosition: 'hidden',
			},
		},
	};
}
