import { useState } from 'react';
import {
	FormComponentAutoComplete,
	FormComponentCalendar,
	FormComponentTime,
} from '@/components/form/form-element.component';
import { Icons } from '@/components/icon.component';
import {
	createFutureDate,
	createPastDate,
	formatDate,
} from '@/helpers/date.helper';
import { requestFind } from '@/helpers/services.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useRemoteAutocomplete } from '@/hooks/use-remote-autocomplete';
import {
	type UserModel,
	UserRoleEnum,
	UserStatusEnum,
} from '@/models/user.model';
import {
	END_AT_MAX_FUTURE_SECONDS,
	START_AT_MAX_PAST_SECONDS,
} from '@/models/work-session.model';
import { useWindowForm } from '@/providers/window-form.provider';
import type { FindFunctionResponseType } from '@/types/action.type';

export type WorkSessionFormValuesType = {
	user_id: number | null;
	user: string | null;
	start_at: string | null;
	start_at_time: string | null;
	end_at_time: string | null;
};

export function FormManageWorkSession() {
	const { formValues, errors, handleChange, pending } =
		useWindowForm<WorkSessionFormValuesType>();

	const elementIds = useElementIds([
		'user',
		'start_at',
		'start_at_time',
		'end_at_time',
	] as const);

	const [searchUser, setSearchUser] = useState('');

	const { suggestions: userSuggestions, isFetching: isUserFetching } =
		useRemoteAutocomplete<UserModel>({
			query: searchUser,
			queryKey: ['s-user'],
			queryFn: async (q) => {
				const res: FindFunctionResponseType<UserModel> | undefined =
					await requestFind('user', {
						filter: {
							term: q,
							role: UserRoleEnum.DRIVER,
							status: UserStatusEnum.ACTIVE,
						},
						limit: 10,
					});

				return res?.entries ?? [];
			},
			minLength: 3,
		});

	const minDate = createPastDate(START_AT_MAX_PAST_SECONDS);
	const minTime = formatDate(minDate, 'time');

	const maxDate = createFutureDate(END_AT_MAX_FUTURE_SECONDS);
	const maxTime = formatDate(maxDate, 'time');

	return (
		<>
			<input
				type="hidden"
				name="user_id"
				value={formValues.user_id ?? ''}
			/>

			<FormComponentAutoComplete<WorkSessionFormValuesType, UserModel>
				labelText="User"
				id={elementIds.user}
				fieldName="user"
				fieldValue={formValues.user ?? ''}
				className="pl-8"
				isRequired={true}
				disabled={pending}
				error={errors.user}
				onInputChange={(value) => {
					handleChange('user', value);
					handleChange('user_id', null);
					setSearchUser(value);
				}}
				autoCompleteProps={{
					suggestions: userSuggestions,
					isLoading: isUserFetching,
					onSelect: (m) => {
						handleChange('user', m.name);
						handleChange('user_id', m.id);
					},
					getOptionLabel: (m) => m.name,
					getOptionKey: (m) => m.id,
				}}
				icons={{
					left: <Icons.User className="opacity-40 h-4.5 w-4.5" />,
				}}
			/>

			<FormComponentCalendar<WorkSessionFormValuesType>
				labelText="Start Date"
				id={elementIds.start_at}
				fieldName="start_at"
				fieldValue={formValues.start_at ?? ''}
				isRequired={true}
				disabled={pending}
				onSelect={(value) => handleChange('start_at', value)}
				minDate={minDate}
				maxDate={maxDate}
				error={errors.start_at}
			/>

			<div className="flex flex-wrap gap-2">
				<FormComponentTime<WorkSessionFormValuesType>
					labelText="Start Time"
					id={elementIds.start_at_time}
					fieldName="start_at_time"
					fieldValue={formValues.start_at_time ?? ''}
					isRequired={true}
					placeholderText="e.g.: 10:30"
					disabled={pending}
					onChange={(e) =>
						handleChange('start_at_time', e.target.value)
					}
					error={errors.start_at_time}
					minTime={minTime ?? ''}
					minuteInterval={5}
				/>
				<FormComponentTime<WorkSessionFormValuesType>
					labelText="End Time"
					id={elementIds.end_at_time}
					fieldName="end_at_time"
					fieldValue={formValues.end_at_time ?? ''}
					isRequired={false}
					placeholderText="e.g.: 10:30"
					disabled={pending}
					onChange={(e) =>
						handleChange('end_at_time', e.target.value)
					}
					error={errors.end_at_time}
					minTime={minTime ?? ''}
					maxTime={maxTime ?? ''}
					minuteInterval={5}
				/>
			</div>
		</>
	);
}
