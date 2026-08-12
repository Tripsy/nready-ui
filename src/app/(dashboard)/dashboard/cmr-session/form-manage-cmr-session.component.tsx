import { useState } from 'react';
import { FormComponentAutoComplete } from '@/components/form/form-element.component';
import { Icons } from '@/components/icon.component';
import { requestFind } from '@/helpers/services.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useRemoteAutocomplete } from '@/hooks/use-remote-autocomplete';
import {
	displayWorkSessionLabel,
	type WorkSessionModel,
	WorkSessionStatusEnum,
} from '@/models/work-session.model';
import { useWindowForm } from '@/providers/window-form.provider';
import type { FindFunctionResponseType } from '@/types/action.type';

export type CmrSessionFormValuesType = {
	cmr_id: number | null;

	work_session_id: number | null;
	work_session: string | null;
};

export function FormManageCmrSession() {
	const { formValues, errors, handleChange, pending } =
		useWindowForm<CmrSessionFormValuesType>();

	const elementIds = useElementIds(['work_session'] as const);

	const [searchWorkSession, setSearchWorkSession] = useState('');

	const {
		suggestions: workSessionSuggestions,
		isFetching: isWorkSessionFetching,
	} = useRemoteAutocomplete<WorkSessionModel>({
		query: searchWorkSession,
		queryKey: ['s-work-session'],
		queryFn: async (q) => {
			const res: FindFunctionResponseType<WorkSessionModel> | undefined =
				await requestFind('work-session', {
					filter: {
						user_name: q,
						status: WorkSessionStatusEnum.ACTIVE,
					},
					limit: 10,
				});

			return res?.entries ?? [];
		},
		minLength: 3,
	});

	return (
		<>
			<input
				type="hidden"
				name="cmr_id"
				value={formValues.cmr_id ?? ''}
			/>

			<input
				type="hidden"
				name="work_session_id"
				value={formValues.work_session_id ?? ''}
			/>

			<FormComponentAutoComplete<
				CmrSessionFormValuesType,
				WorkSessionModel
			>
				labelText="User Work Session"
				id={elementIds.work_session}
				fieldName="work_session"
				fieldValue={formValues.work_session ?? ''}
				className="pl-8"
				isRequired={true}
				disabled={pending}
				error={errors.work_session}
				onInputChange={(value) => {
					handleChange('work_session', value);
					handleChange('work_session_id', null);
					setSearchWorkSession(value);
				}}
				autoCompleteProps={{
					suggestions: workSessionSuggestions,
					isLoading: isWorkSessionFetching,
					onSelect: (m) => {
						handleChange(
							'work_session',
							displayWorkSessionLabel(m),
						);
						handleChange('work_session_id', m.id);
					},
					getOptionLabel: (m) => displayWorkSessionLabel(m),
					getOptionKey: (m) => m.id,
				}}
				icons={{
					left: (
						<Icons.WorkSession className="opacity-40 h-4.5 w-4.5" />
					),
				}}
			/>
		</>
	);
}
