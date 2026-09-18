import { useState } from 'react';
import { FormComponentAutoComplete } from '@/components/form/form-element.component';
import { Icons } from '@/components/icon.component';
import { requestFind } from '@/helpers/services.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useRemoteAutocomplete } from '@/hooks/use-remote-autocomplete';
import { displayUserLabel, type UserModel } from '@/models/user.model';
import { useWindowForm } from '@/providers/window-form.provider';
import type { FindFunctionResponseType } from '@/types/action.type';

export type ClientAccountFormValuesType = {
	/** The account to link the client to. */
	user_id: number | null;
	// display-only fields, not part of validation
	/** The autocomplete's visible text. Submitted as `user_label` and never sent on. */
	user: string | null;
};

export function FormAccountClient() {
	const { formValues, errors, handleChange, pending } =
		useWindowForm<ClientAccountFormValuesType>();

	const elementIds = useElementIds(['user'] as const);

	const [searchUser, setSearchUser] = useState('');

	const { suggestions: userSuggestions, isFetching: isUserFetching } =
		useRemoteAutocomplete<UserModel>({
			query: searchUser,
			queryKey: ['s-client-user'],
			queryFn: async (term) => {
				const response:
					| FindFunctionResponseType<UserModel>
					| undefined = await requestFind('user', {
					filter: { term: term },
					limit: 10,
				});

				return response?.entries ?? [];
			},
			minLength: 3,
		});

	return (
		<>
			{/*
			 * The id is what the backend takes; the visible box carries the label only. Both are
			 * submitted so a failed validation redraws the box with the account already picked.
			 * Typing clears the id, so only a picked suggestion validates.
			 */}
			<input
				type="hidden"
				name="user_id"
				value={formValues.user_id ?? ''}
			/>
			<input
				type="hidden"
				name="user_label"
				value={formValues.user ?? ''}
			/>
			<FormComponentAutoComplete<ClientAccountFormValuesType, UserModel>
				labelText="Account"
				id={elementIds.user}
				fieldName="user"
				fieldValue={formValues.user ?? ''}
				className="pl-8"
				isRequired={true}
				disabled={pending}
				error={errors.user_id}
				onInputChange={(value) => {
					handleChange('user', value);
					handleChange('user_id', null);
					setSearchUser(value);
				}}
				autoCompleteProps={{
					suggestions: userSuggestions,
					isLoading: isUserFetching,
					onSelect: (user) => {
						handleChange('user', displayUserLabel(user));
						handleChange('user_id', user.id);
					},
					getOptionLabel: (user) =>
						`${displayUserLabel(user)} - ${user.email}`,
					getOptionKey: (user) => user.id,
				}}
				icons={{
					left: <Icons.User className="opacity-40 h-4.5 w-4.5" />,
				}}
			/>
		</>
	);
}
