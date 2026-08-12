import { z } from 'zod';
import { DataTableValue } from '@/app/(dashboard)/_components/data-table-value';
import {
	type CmrSessionFormValuesType,
	FormManageCmrSession,
} from '@/app/(dashboard)/dashboard/cmr-session/form-manage-cmr-session.component';
import { ViewCmrSession } from '@/app/(dashboard)/dashboard/cmr-session/view-cmr-session.component';
import { translateBatch } from '@/config/translate.setup';
import {
	getFormDataAsNumber,
	getFormDataAsString,
} from '@/helpers/form.helper';
import { requestFind } from '@/helpers/services.helper';
import { BaseValidator } from '@/helpers/validator.helper';
import { type AuthModel, hasPermission } from '@/models/auth.model';
import {
	type CmrModel,
	type CmrStatus,
	displayCmrLabel,
} from '@/models/cmr.model';
import {
	type CmrSessionModel,
	displayCmrSessionLabel,
} from '@/models/cmr-session.model';
import {
	displayWorkSessionLabel,
	type WorkSessionModel,
	type WorkSessionStatus,
} from '@/models/work-session.model';
import {
	createCmrSession,
	deleteCmrSession,
} from '@/services/cmr-session.service';
import type { FindFunctionParamsType } from '@/types/action.type';
import type {
	DataSourceConfigType,
	DataTableValueOptionsType,
} from '@/types/data-source.type';
import type { FormStateType } from '@/types/form.type';

const validatorMessages = [
	'invalid_cmr_id',
	'invalid_work_session_id',
	'invalid_work_session',
] as const;

class CmrSessionValidator extends BaseValidator<typeof validatorMessages> {
	create = (isSubmit: boolean = true) =>
		z
			.object({
				cmr_id: this.validateId(this.getMessage('invalid_cmr_id')),
				work_session_id: this.validateId(
					this.getMessage('invalid_work_session_id'),
					{
						required: false, // Further check is done in superRefine
					},
				),
				work_session: this.validateString(
					this.getMessage('invalid_work_session'),
				),
			})
			.superRefine((data, ctx) => {
				if (isSubmit && data.work_session && !data.work_session_id) {
					ctx.addIssue({
						path: ['work_session'],
						message: this.getMessage('invalid_work_session_id'),
						code: 'custom',
					});
				}
			});
}

async function validateForm(
	values: CmrSessionFormValuesType,
	isSubmit: boolean = true,
) {
	const translations = await translateBatch(
		validatorMessages,
		'cmr-session.validation',
	);

	const validator = new CmrSessionValidator(translations);

	return validator.create(isSubmit).safeParse(values);
}

function getFormValues(formData: FormData): CmrSessionFormValuesType {
	return {
		cmr_id: getFormDataAsNumber(formData, 'cmr_id'),
		work_session_id: getFormDataAsNumber(formData, 'work_session_id'),
		work_session: getFormDataAsString(formData, 'work_session'),
	};
}

function getFormState(
	data?: CmrSessionModel,
): FormStateType<CmrSessionFormValuesType> {
	return {
		errors: {},
		message: null,
		situation: null,
		values: {
			cmr_id: data?.cmr?.id ?? null,
			work_session_id: data?.work_session?.id ?? null,
			work_session: data?.work_session
				? displayWorkSessionLabel(data?.work_session)
				: null,
		},
	};
}

export type CmrSessionDataTableFiltersType = {
	user: { value: string | null; matchMode: 'equals' };
	user_id: { value: number | null; matchMode: 'equals' };
	work_session_id: { value: string | null; matchMode: 'equals' };
	cmr_id: { value: string | null; matchMode: 'equals' };
	cmr_status: { value: CmrStatus | null; matchMode: 'equals' };
	work_session_status: {
		value: WorkSessionStatus | null;
		matchMode: 'equals';
	};
};

export default async function dataSourceConfig(): Promise<
	DataSourceConfigType<CmrSessionModel>
> {
	const translations = await translateBatch(
		[
			'create.title',
			'update.title',
			'delete.title',
			'view.title',
			'viewWorkSession.title',
			'viewCmr.title',
		] as const,
		'cmr-session.action',
	);

	function displayButtonView(
		auth: AuthModel | null,
	): DataTableValueOptionsType<CmrSessionModel>['displayButton'] {
		return {
			action: () =>
				hasPermission(auth, 'cmr-session', 'read') ? 'view' : undefined,
			dataSource: 'cmr-session',
		};
	}

	function displayButtonViewWorkSession(
		auth: AuthModel | null,
		entry: CmrSessionModel,
	): DataTableValueOptionsType<CmrSessionModel>['displayButton'] {
		if (!entry.work_session) {
			return undefined;
		}

		return {
			action: () =>
				hasPermission(auth, 'work-session', 'read')
					? 'view'
					: undefined,
			dataSource: 'work-session',
			title: translations['viewWorkSession.title'],
			alternateEntryId: entry.work_session.id,
		};
	}

	function displayButtonViewCmr(
		auth: AuthModel | null,
		entry: CmrSessionModel,
	): DataTableValueOptionsType<CmrSessionModel>['displayButton'] {
		if (!entry.cmr) {
			return undefined;
		}

		return {
			action: () =>
				hasPermission(auth, 'cmr', 'read') ? 'view' : undefined,
			dataSource: 'cmr',
			title: translations['viewCmr.title'],
			alternateEntryId: entry.cmr.id,
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
					user: { value: '', matchMode: 'equals' },
					user_id: { value: null, matchMode: 'equals' },
					work_session_id: { value: null, matchMode: 'equals' },
					cmr_id: { value: null, matchMode: 'equals' },
					cmr_status: { value: null, matchMode: 'equals' },
					work_session_status: { value: null, matchMode: 'equals' },
				} satisfies CmrSessionDataTableFiltersType,
			},
			columns: [
				{
					field: 'id',
					header: 'ID',
					defaultWidth: 88,
					sortable: true,
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							displayButton: displayButtonView(auth),
						}),
				},
				{
					field: 'cmr',
					header: 'CMR',
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							customValue: displayCmrLabel(entry.cmr),
							displayButton: displayButtonViewCmr(auth, entry),
						}),
				},
				{
					field: 'cmr_status',
					header: 'CMR Status',
					body: (entry) =>
						DataTableValue<CmrModel>(entry.cmr, 'status', {
							isStatus: true,
							dataSource: 'cmr',
						}),
					minWidth: 128,
					maxWidth: 128,
				},
				{
					field: 'work_session',
					header: 'Work Session',
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							customValue: displayWorkSessionLabel(
								entry.work_session,
							),
							displayButton: displayButtonViewWorkSession(
								auth,
								entry,
							),
						}),
				},
				{
					field: 'work_session_status',
					header: 'Work Session Status',
					body: (entry) =>
						DataTableValue<WorkSessionModel>(
							entry.work_session,
							'status',
							{
								isStatus: true,
								dataSource: 'work-session',
							},
						),
					minWidth: 128,
					maxWidth: 128,
				},
			],
			find: (params: FindFunctionParamsType) =>
				requestFind<CmrSessionModel>('cmr-session', params),
		},
		displayEntryLabel: (entry: CmrSessionModel) => {
			return displayCmrSessionLabel(entry);
		},
		actions: {
			create: {
				windowType: 'form',
				windowTitle: translations['create.title'],
				windowComponent: FormManageCmrSession,
				permission: ['cmr-session', 'create'],
				entriesSelection: 'free',
				operationFunction: (params: CmrSessionFormValuesType) => {
					const { cmr_id, work_session, ...prepareParams } = params;

					return createCmrSession(prepareParams, cmr_id as number);
				},
				buttonPosition: 'hidden',
				button: {
					variant: 'default',
				},
				getFormValues: getFormValues,
				validateForm: validateForm,
				getFormState: getFormState,
			},
			delete: {
				windowType: 'action',
				windowTitle: translations['delete.title'],
				permission: ['cmr-session', 'delete'],
				entriesSelection: 'single',
				operationFunction: (entry: CmrSessionModel) =>
					deleteCmrSession(entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
			view: {
				windowType: 'view',
				windowTitle: translations['view.title'],
				windowComponent: ViewCmrSession,
				windowConfigProps: {
					size: 'xl',
					closeOnBackdrop: true,
					closeOnEscape: true,
				},
				permission: ['cmr-session', 'read'],
				entriesSelection: 'single',
				buttonPosition: 'hidden',
			},
		},
	};
}
