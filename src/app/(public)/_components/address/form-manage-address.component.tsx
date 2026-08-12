import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import {
	FormComponentAutoComplete,
	FormComponentInput,
} from '@/components/form/form-element.component';
import { Icons } from '@/components/icon.component';
import { getLanguageClient } from '@/config/translate.setup';
import { requestCreate, requestFind } from '@/helpers/services.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useRemoteAutocomplete } from '@/hooks/use-remote-autocomplete';
import { useTranslation } from '@/hooks/use-translation.hook';
import {
	CITY_DEFAULT,
	displayPlaceLabel,
	type PlaceModel,
	PlaceTypeEnum,
} from '@/models/place.model';
import { useWindowForm } from '@/providers/window-form.provider';
import type { FindFunctionResponseType } from '@/types/action.type';
import type { ApiResponseFetch } from '@/types/api.type';

export type AddressFormValuesType = {
	city_id: number | null;
	city: string | null;
	details: string | null;
	postal_code: string | null;
};

const TRANSLATION_KEYS = [
	'address.field.city',
	'address.field.details',
	'address.field.postal_code',
] as const;

export function FormManageAddress() {
	const { formValues, errors, handleChange, pending } =
		useWindowForm<AddressFormValuesType>();

	const { translations } = useTranslation(TRANSLATION_KEYS);

	const queryClient = useQueryClient();

	const elementIds = useElementIds([
		'city',
		'details',
		'postal_code',
	] as const);

	const [searchCity, setSearchCity] = useState('');
	const language = getLanguageClient();

	const { suggestions: citySuggestions, isFetching: isCityFetching } =
		useRemoteAutocomplete<PlaceModel>({
			query: searchCity,
			queryKey: ['s-city'],
			queryFn: async (q) => {
				const res: FindFunctionResponseType<PlaceModel> | undefined =
					await requestFind('place', {
						filter: { term: q, place_type: PlaceTypeEnum.CITY },
						limit: 10,
					});

				return res?.entries ?? [];
			},
			minLength: 3,
		});

	const invalidateCitySuggestions = useCallback(
		() =>
			queryClient.invalidateQueries({
				queryKey: ['s-city'],
			}),
		[queryClient],
	);

	const createCityMutation = useMutation({
		mutationFn: async (name: string) => {
			const res: ApiResponseFetch<Partial<PlaceModel>> =
				await requestCreate('place', {
					...CITY_DEFAULT,
					contents: [
						{
							...CITY_DEFAULT.contents[0],
							language,
							name,
						},
					],
				});

			return res?.data;
		},
	});

	return (
		<>
			<input
				type="hidden"
				name="city_id"
				value={formValues.city_id ?? ''}
			/>
			<FormComponentAutoComplete<AddressFormValuesType, PlaceModel>
				labelText={translations['address.field.city']}
				id={elementIds.city}
				fieldName="city"
				fieldValue={formValues.city ?? ''}
				className="pl-8"
				isRequired={false}
				disabled={pending}
				error={errors.city}
				onInputChange={(value) => {
					handleChange('city', value);
					handleChange('city_id', null);
					setSearchCity(value);
				}}
				autoCompleteProps={{
					suggestions: citySuggestions,
					isLoading: isCityFetching,
					onSelect: (c) => {
						handleChange('city', displayPlaceLabel(c, language));
						handleChange('city_id', c.id);
					},
					getOptionLabel: (c) => displayPlaceLabel(c, language),
					getOptionKey: (c) => c.id,

					allowCreate: true,

					onCreate: async (value) => {
						const newCity =
							await createCityMutation.mutateAsync(value);

						if (!newCity) {
							return;
						}

						handleChange('city', value);
						handleChange('city_id', newCity.id as number);

						await invalidateCitySuggestions();
					},

					createLabel: (value) => `Create city "${value}"`,
				}}
				icons={{
					left: <Icons.City className="opacity-40 h-4.5 w-4.5" />,
				}}
			/>

			<FormComponentInput<AddressFormValuesType>
				labelText={translations['address.field.details']}
				id={elementIds.details}
				fieldName="details"
				fieldValue={formValues.details ?? ''}
				isRequired={true}
				placeholderText="e.g.: Str Victoriei 15"
				disabled={pending}
				onChange={(e) => handleChange('details', e.target.value)}
				error={errors.details}
			/>

			<FormComponentInput<AddressFormValuesType>
				labelText={translations['address.field.postal_code']}
				id={elementIds.postal_code}
				fieldName="postal_code"
				fieldValue={formValues.postal_code ?? ''}
				placeholderText="e.g.: 067895"
				disabled={pending}
				onChange={(e) => handleChange('postal_code', e.target.value)}
				error={errors.postal_code}
			/>
		</>
	);
}
