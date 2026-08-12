import { z } from 'zod';
import {
	FormManageWorkSession,
	type WorkSessionFormValuesType,
} from '@/app/(public)/_components/work-session/form-manage-work-session.component';
import { translateBatch } from '@/config/translate.setup';
import {
	combineDateAndTime,
	formatDate,
	stringToDate,
} from '@/helpers/date.helper';
import { getFormDataAsString } from '@/helpers/form.helper';
import { requestUpdateStatus } from '@/helpers/services.helper';
import { BaseValidator } from '@/helpers/validator.helper';
import type { UserModel } from '@/models/user.model';
import {
	displayWorkSessionLabel,
	START_AT_MAX_PAST_SECONDS,
	type WorkSessionModel,
} from '@/models/work-session.model';
import type { DataSourceConfigType } from '@/types/data-source.type';
import type { FormStateType, ValidatorOutput } from '@/types/form.type';

const validatorMessages = [
	'invalid_start_at',
	'invalid_start_at_time',
] as const;

class WorkSessionValidator extends BaseValidator<typeof validatorMessages> {
	create = () =>
		z.object({
			start_at: this.validateDate(this.getMessage('invalid_start_at'), {
				required: true,
				maxFutureSeconds: START_AT_MAX_PAST_SECONDS,
			}),
			start_at_time: this.validateTime(
				this.getMessage('invalid_start_at_time'),
				{
					required: true,
				},
			),
		});
}

async function validateFormCreate(values: WorkSessionFormValuesType) {
	const translations = await translateBatch(
		validatorMessages,
		'work-session.validation',
	);

	const validator = new WorkSessionValidator(translations);

	return validator.create().safeParse(values);
}

function getFormValues(formData: FormData): WorkSessionFormValuesType {
	return {
		start_at: getFormDataAsString(formData, 'start_at'),
		start_at_time: getFormDataAsString(formData, 'start_at_time'),
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
			start_at: formatDate(data?.start_at, 'default') ?? null,
			start_at_time: formatDate(data?.start_at, 'time') ?? null,
		},
	};
}

export type WorkSessionCreateOutput = ValidatorOutput<
	WorkSessionValidator,
	'create'
>;

export function prepareParamsFromFormValues(
	user: UserModel,
	data: WorkSessionCreateOutput,
) {
	const date_start_at = stringToDate(data.start_at);
	const determined_start_at = combineDateAndTime(
		date_start_at,
		data.start_at_time,
	);
	return {
		user_id: user.id,
		start_at: determined_start_at,
	};
}

export default async function dataSourceConfig(): Promise<
	DataSourceConfigType<WorkSessionModel>
> {
	const translations = await translateBatch(
		['create.title', 'close.title'] as const,
		'driver-panel.work-session.action',
	);

	return {
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
				operationFunction: () => {
					// It is overridden in the component
					throw new Error('Not defined here');
				},
				buttonPosition: 'right',
				button: {
					variant: 'default',
				},
				getFormValues: getFormValues,
				validateForm: validateFormCreate,
				getFormState: getFormState,
			},
			close: {
				windowType: 'action',
				windowTitle: translations['close.title'],
				permission: ['work-session', 'update'],
				entriesSelection: 'single',
				operationFunction: (entry: WorkSessionModel) =>
					requestUpdateStatus('work-session', entry, 'closed'),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
		},
	};
}
