import { z } from 'zod';
import { DataTableValue } from '@/app/(dashboard)/_components/data-table-value';
import {
	FormManageWorkSession,
	type WorkSessionFormValuesType,
} from '@/app/(dashboard)/dashboard/work-session/form-manage-work-session.component';
import { SetupWorkSessionVehicles } from '@/app/(dashboard)/dashboard/work-session/setup-work-session-vehicles.component';
import { ViewWorkSession } from '@/app/(dashboard)/dashboard/work-session/view-work-session.component';
import { translateBatch } from '@/config/translate.setup';
import {
	combineDateAndTime,
	formatDate,
	stringToDate,
} from '@/helpers/date.helper';
import {
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
import { BaseValidator } from '@/helpers/validator.helper';
import { type AuthModel, hasPermission } from '@/models/auth.model';
import {
	determineEndAt,
	displayWorkSessionDuration,
	displayWorkSessionLabel,
	START_AT_MAX_PAST_SECONDS,
	type WorkSessionModel,
	type WorkSessionStatus,
	WorkSessionStatusEnum,
} from '@/models/work-session.model';
import type { FindFunctionParamsType } from '@/types/action.type';
import type {
	DataSourceConfigType,
	DataTableValueOptionsType,
} from '@/types/data-source.type';
import type { FormStateType, ValidatorOutput } from '@/types/form.type';

const validatorMessages = [
	'invalid_user_id',
	'invalid_user',
	'invalid_start_at',
	'invalid_start_at_time',
	'invalid_end_at_time',
] as const;

class WorkSessionValidator extends BaseValidator<typeof validatorMessages> {
	create = (isSubmit: boolean = true) =>
		z
			.object({
				user_id: this.validateId(this.getMessage('invalid_user_id'), {
					required: false, // Further check is done in superRefine
				}),
				user: this.validateString(this.getMessage('invalid_user')),
				start_at: this.validateDate(
					this.getMessage('invalid_start_at'),
					{
						required: true,
						maxFutureSeconds: START_AT_MAX_PAST_SECONDS,
					},
				),
				start_at_time: this.validateTime(
					this.getMessage('invalid_start_at_time'),
					{
						required: true,
					},
				),
				end_at_time: this.validateTime(
					this.getMessage('invalid_end_at_time'),
					{
						required: false,
					},
				),
			})
			.superRefine((data, ctx) => {
				if (isSubmit && data.user && !data.user_id) {
					ctx.addIssue({
						path: ['user'],
						message: this.getMessage('invalid_user_id'),
						code: 'custom',
					});
				}
			});

	update = (isSubmit: boolean = true) =>
		z
			.object({
				user_id: this.validateId(this.getMessage('invalid_user_id'), {
					required: false,
				}),
				user: this.validateString(this.getMessage('invalid_user')),
				start_at: this.validateDate(
					this.getMessage('invalid_start_at'),
					{
						required: true,
					},
				),
				start_at_time: this.validateTime(
					this.getMessage('invalid_start_at_time'),
					{
						required: true,
					},
				),
				end_at_time: this.validateTime(
					this.getMessage('invalid_end_at_time'),
					{
						required: false,
					},
				),
			})
			.superRefine((data, ctx) => {
				if (isSubmit && data.user && !data.user_id) {
					ctx.addIssue({
						path: ['user'],
						message: this.getMessage('invalid_user_id'),
						code: 'custom',
					});
				}
			});
}

async function validateFormCreate(
	values: WorkSessionFormValuesType,
	isSubmit: boolean = true,
) {
	const translations = await translateBatch(
		validatorMessages,
		'work-session.validation',
	);

	const validator = new WorkSessionValidator(translations);

	return validator.create(isSubmit).safeParse(values);
}

async function validateFormUpdate(
	values: WorkSessionFormValuesType,
	isSubmit: boolean = true,
) {
	const translations = await translateBatch(
		validatorMessages,
		'work-session.validation',
	);

	const validator = new WorkSessionValidator(translations);

	return validator.update(isSubmit).safeParse(values);
}

function getFormValues(formData: FormData): WorkSessionFormValuesType {
	return {
		user_id: getFormDataAsNumber(formData, 'user_id'),
		user: getFormDataAsString(formData, 'user'),
		start_at: getFormDataAsString(formData, 'start_at'),
		start_at_time: getFormDataAsString(formData, 'start_at_time'),
		end_at_time: getFormDataAsString(formData, 'end_at_time'),
	};
}

function getFormState(
	data?: WorkSessionModel,
): FormStateType<WorkSessionFormValuesType> {
	return {
		errors: {},
		message: null,
		situation: null,
		values: {
			user_id: data?.user?.id ?? null,
			user: data?.user ? data?.user?.name : null,
			start_at: formatDate(data?.start_at, 'default') ?? null,
			start_at_time: formatDate(data?.start_at, 'time') ?? null,
			end_at_time: formatDate(data?.end_at, 'time') ?? null,
		},
	};
}

type WorkSessionCreateOutput = ValidatorOutput<WorkSessionValidator, 'create'>;
type WorkSessionUpdateOutput = ValidatorOutput<WorkSessionValidator, 'update'>;

function prepareParamsFromFormValues(
	data: WorkSessionCreateOutput | WorkSessionUpdateOutput,
) {
	const { user, start_at, start_at_time, end_at_time, ...prepareParams } =
		data;

	const date_start_at = stringToDate(start_at);
	const determined_start_at = combineDateAndTime(
		date_start_at,
		start_at_time,
	);
	const determined_end_at = end_at_time
		? determineEndAt(date_start_at, start_at_time, end_at_time)
		: null;

	return {
		...prepareParams,
		start_at: determined_start_at,
		end_at: determined_end_at,
	};
}

export type WorkSessionDataTableFiltersType = {
	global: { value: string | null; matchMode: 'contains' };
	user: { value: string | null; matchMode: 'equals' };
	user_id: { value: number | null; matchMode: 'equals' };
	status: { value: WorkSessionStatus | null; matchMode: 'equals' };
	start_at_start: { value: string | null; matchMode: 'equals' };
	start_at_end: { value: string | null; matchMode: 'equals' };
	is_deleted: { value: boolean; matchMode: 'equals' };
};

export default async function dataSourceConfig(): Promise<
	DataSourceConfigType<WorkSessionModel>
> {
	const translations = await translateBatch(
		[
			'create.title',
			'update.title',
			'view.title',
			'delete.title',
			'restore.title',
			'close.title',
			'viewUser.title',
			'setupVehicles.title',
		] as const,
		'work-session.action',
	);

	function displayButtonView(
		auth: AuthModel | null,
	): DataTableValueOptionsType<WorkSessionModel>['displayButton'] {
		return {
			action: () =>
				hasPermission(auth, 'work-session', 'read')
					? 'view'
					: undefined,
			dataSource: 'work-session',
		};
	}

	function displayButtonStatus(
		auth: AuthModel | null,
	): DataTableValueOptionsType<WorkSessionModel>['displayButton'] {
		return {
			action: (entry: WorkSessionModel) => {
				if (entry.deleted_at) {
					return hasPermission(auth, 'work-session', 'delete')
						? 'restore'
						: undefined;
				}

				if (!hasPermission(auth, 'work-session', 'update')) {
					return undefined;
				}

				return entry.status === WorkSessionStatusEnum.ACTIVE
					? 'close'
					: undefined;
			},
		};
	}

	function displayButtonViewUser(
		auth: AuthModel | null,
		entry: WorkSessionModel,
	): DataTableValueOptionsType<WorkSessionModel>['displayButton'] {
		if (!entry.user) {
			return undefined;
		}

		return {
			action: () =>
				hasPermission(auth, 'user', 'read') ? 'view' : undefined,
			dataSource: 'user',
			title: translations['viewUser.title'],
			alternateEntryId: entry.user.id,
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
					user: { value: '', matchMode: 'equals' },
					user_id: { value: null, matchMode: 'equals' },
					status: { value: null, matchMode: 'equals' },
					start_at_start: { value: null, matchMode: 'equals' },
					start_at_end: { value: null, matchMode: 'equals' },
					is_deleted: { value: false, matchMode: 'equals' },
				} satisfies WorkSessionDataTableFiltersType,
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
					field: 'user',
					header: 'User',
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							customValue: entry.user.name,
							displayButton: displayButtonViewUser(auth, entry),
						}),
				},
				{
					field: 'start_at',
					header: 'Start At',
					body: (entry, column) =>
						DataTableValue(entry, column, {
							displayDate: true,
						}),
				},
				{
					field: 'end_at',
					header: 'End At',
					body: (entry, column) =>
						DataTableValue(entry, column, {
							displayDate: true,
						}),
				},
				{
					field: 'duration',
					header: 'Duration',
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: displayWorkSessionDuration(entry),
						}),
				},
				{
					field: 'status',
					header: 'Status',
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							dataSource: 'work-session',
							isStatus: true,
							markDeleted: true,
							displayButton: displayButtonStatus(auth),
						}),
					minWidth: 128,
					maxWidth: 128,
				},
			],
			find: (params: FindFunctionParamsType) =>
				requestFind<WorkSessionModel>('work-session', params),
		},
		displayEntryLabel: (entry: WorkSessionModel) => {
			return displayWorkSessionLabel(entry);
		},
		actions: {
			create: {
				windowType: 'form',
				windowTitle: translations['create.title'],
				windowComponent: FormManageWorkSession,
				permission: ['work-session', 'create'],
				entriesSelection: 'free',
				operationFunction: (values: WorkSessionCreateOutput) => {
					const params = prepareParamsFromFormValues(values);

					return requestCreate<WorkSessionModel, typeof params>(
						'work-session',
						params,
					);
				},
				buttonPosition: 'right',
				button: {
					variant: 'default',
				},
				getFormValues: getFormValues,
				validateForm: validateFormCreate,
				getFormState: getFormState,
			},
			update: {
				windowType: 'form',
				windowTitle: translations['update.title'],
				windowComponent: FormManageWorkSession,
				permission: ['work-session', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: WorkSessionModel) =>
					!entry.deleted_at, // Return true if the entry is not deleted
				operationFunction: (
					values: WorkSessionUpdateOutput,
					id: number,
				) => {
					const params = prepareParamsFromFormValues(values);

					return requestUpdate<WorkSessionModel, typeof params>(
						'work-session',
						params,
						id,
					);
				},
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'success',
				},
				getFormValues: getFormValues,
				validateForm: validateFormUpdate,
				getFormState: getFormState,
			},
			delete: {
				windowType: 'action',
				windowTitle: translations['delete.title'],
				permission: ['work-session', 'delete'],
				entriesSelection: 'single',
				customEntryCheck: (entry: WorkSessionModel) =>
					!entry.deleted_at, // Return true if the entry is not deleted
				operationFunction: (entry: WorkSessionModel) =>
					requestDelete('work-session', entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
			restore: {
				windowType: 'action',
				windowTitle: translations['restore.title'],
				permission: ['work-session', 'delete'],
				entriesSelection: 'single',
				customEntryCheck: (entry: WorkSessionModel) =>
					!!entry.deleted_at, // Return true if the entry is deleted
				operationFunction: (entry: WorkSessionModel) =>
					requestRestore('work-session', entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'default',
				},
			},
			close: {
				windowType: 'action',
				windowTitle: translations['close.title'],
				permission: ['work-session', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: WorkSessionModel) =>
					!entry.deleted_at &&
					arrayHasValue(entry.status, [WorkSessionStatusEnum.ACTIVE]),
				operationFunction: (entry: WorkSessionModel) =>
					requestUpdateStatus('work-session', entry, 'closed'),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
			view: {
				windowType: 'view',
				windowTitle: translations['view.title'],
				windowComponent: ViewWorkSession,
				windowConfigProps: {
					size: 'xl',
				},
				permission: ['work-session', 'read'],
				entriesSelection: 'single',
				buttonPosition: 'hidden',
			},
			setupVehicles: {
				windowType: 'other',
				windowTitle: translations['setupVehicles.title'],
				windowComponent: SetupWorkSessionVehicles,
				windowConfigProps: {
					size: 'x2l',
				},
				permission: ['work-session-vehicle', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: WorkSessionModel) =>
					!entry.deleted_at &&
					entry.status === WorkSessionStatusEnum.ACTIVE,
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'default',
				},
			},
		},
	};
}
