import { useRef, useState } from 'react';
import {
	FormComponentAutoComplete,
	FormComponentInput,
	FormComponentRadio,
} from '@/components/form/form-element.component';
import { Icons } from '@/components/icon.component';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Configuration } from '@/config/settings.config';
import { getLanguageClient } from '@/config/translate.setup';
import { toOptionsFromEnum } from '@/helpers/form.helper';
import { requestFind } from '@/helpers/services.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useRemoteAutocomplete } from '@/hooks/use-remote-autocomplete';
import {
	displayPlaceLabel,
	getParentPlaceType,
	type PlaceContent,
	type PlaceModel,
	type PlaceType,
	PlaceTypeEnum,
} from '@/models/place.model';
import { useWindowForm } from '@/providers/window-form.provider';
import type { FindFunctionResponseType } from '@/types/action.type';
import { type Language, LanguageEnum } from '@/types/common.type';

export type PlaceFormValuesType = {
	place_type: PlaceType;
	code: string | null;
	parent_id: number | null;
	parent: string | null;
	contents: PlaceContent[];
};

const languages = Object.values(LanguageEnum);

const placeTypes = toOptionsFromEnum(PlaceTypeEnum, {
	formatter: formatEnumLabel,
});

export function FormManagePlace() {
	const { formValues, errors, handleChange, pending } =
		useWindowForm<PlaceFormValuesType>();

	const elementIds = useElementIds([
		'placeType',
		'code',
		'parent',
		'contents',
	] as const);

	const previousParentsRef = useRef<
		Partial<
			Record<
				PlaceType,
				{ parent: string | null; parent_id: number | null }
			>
		>
	>({});

	const handlePlaceTypeChange = (value: PlaceType) => {
		if (formValues.parent_id) {
			previousParentsRef.current[formValues.place_type] = {
				parent: formValues.parent,
				parent_id: formValues.parent_id,
			};
		}

		// Restore selection if was set previously
		const previous = previousParentsRef.current[value];

		handleChange('place_type', value);
		handleChange('parent', previous?.parent ?? null);
		handleChange('parent_id', previous?.parent_id ?? null);
		setSearchParentPlaces('');
	};

	const [selectedLanguage, setSelectedLanguage] = useState<Language>(
		getLanguageClient(),
	);
	const [searchParentPlaces, setSearchParentPlaces] = useState('');

	const parentPlaceType = getParentPlaceType(formValues.place_type);

	const {
		suggestions: parentPlacesSuggestions,
		isFetching: isParentPlacesFetching,
	} = useRemoteAutocomplete<PlaceModel>({
		query: parentPlaceType ? searchParentPlaces : '', // Do not query if no parent type
		queryKey: ['s-parent-place', parentPlaceType],
		queryFn: async (q) => {
			const res: FindFunctionResponseType<PlaceModel> | undefined =
				await requestFind('place', {
					filter: { term: q, place_type: parentPlaceType },
					limit: 10,
				});

			return res?.entries ?? [];
		},
		minLength: 3,
	});

	// Derive map from formValues
	const [contentsMap, setContentsMap] = useState<
		Partial<Record<Language, PlaceContent>>
	>(
		() =>
			Object.fromEntries(
				(formValues.contents ?? []).map((c) => [c.language, c]),
			) as Partial<Record<Language, PlaceContent>>,
	);

	const handleContentChange = (
		language: Language,
		field: keyof PlaceContent,
		value: string,
	) => {
		const updated = {
			...contentsMap,
			[language]: {
				...contentsMap[language],
				language,
				[field]: value,
			},
		};

		setContentsMap(updated);

		// Sync back to formValues as array
		handleChange(
			'contents',
			Object.values(updated).filter((c): c is PlaceContent => !!c),
		);
	};

	return (
		<>
			<FormComponentRadio<PlaceFormValuesType>
				labelText="Type"
				id={elementIds.placeType}
				fieldName="place_type"
				fieldValue={formValues.place_type}
				options={placeTypes}
				disabled={pending}
				onChange={(value) => handlePlaceTypeChange(value as PlaceType)}
				error={errors.place_type}
			/>

			<FormComponentInput<PlaceFormValuesType>
				id={elementIds.code}
				labelText="Code"
				fieldName="code"
				fieldValue={formValues.code ?? ''}
				className="pl-8"
				isRequired={true}
				placeholderText="eg: RO"
				icons={{
					left: <Icons.Code className="opacity-40 h-4.5 w-4.5" />,
				}}
				disabled={pending}
				onChange={(e) => handleChange('code', e.target.value)}
				error={errors.code}
			/>

			{parentPlaceType && (
				<>
					<input
						type="hidden"
						name="parent_id"
						value={formValues.parent_id ?? ''}
					/>
					<FormComponentAutoComplete<PlaceFormValuesType, PlaceModel>
						labelText="Parent"
						id={elementIds.parent}
						fieldName="parent"
						fieldValue={formValues.parent ?? ''}
						className="pl-8"
						isRequired={false}
						disabled={pending}
						error={errors.parent}
						onInputChange={(value) => {
							handleChange('parent', value);
							handleChange('parent_id', null);
							setSearchParentPlaces(value);
						}}
						autoCompleteProps={{
							suggestions: parentPlacesSuggestions,
							isLoading: isParentPlacesFetching,
							onSelect: (m) => {
								handleChange(
									'parent',
									displayPlaceLabel(m, selectedLanguage),
								);
								handleChange('parent_id', m.id);
							},
							getOptionLabel: (m) =>
								displayPlaceLabel(m, selectedLanguage),
							getOptionKey: (m) => m.id,
						}}
						icons={{
							left: (
								<Icons.Location className="opacity-40 h-4.5 w-4.5" />
							),
						}}
					/>
				</>
			)}

			<input
				type="hidden"
				name="contents"
				value={JSON.stringify(
					Object.values(formValues.contents).filter(
						Boolean,
					) as PlaceContent[],
				)}
			/>
			<Tabs
				defaultSelectedKey={Configuration.defaultLanguage()}
				onSelectionChange={(key) =>
					setSelectedLanguage(String(key) as Language)
				}
				className="w-full"
			>
				<div className="flex items-center border-b border-line pb-2 gap-2">
					<h3 className="font-bold whitespace-nowrap">
						Language specific
					</h3>
					<TabsList>
						{languages.map((language) => (
							<TabsTrigger key={language} id={language}>
								{language.toUpperCase()}
							</TabsTrigger>
						))}
					</TabsList>
				</div>
				{languages.map((language) => {
					const findIndex = formValues.contents.findIndex(
						(c) => c.language === language,
					);

					const contentIndex =
						findIndex === -1 &&
						language === Configuration.defaultLanguage()
							? 0
							: findIndex;

					return (
						<TabsContent key={`form-${language}`} id={language}>
							<div className="form-section">
								<FormComponentInput<PlaceContent>
									id={`${elementIds.contents}-${language}-name`}
									labelText="Name"
									fieldName="name"
									fieldValue={
										contentsMap[language]?.name ?? ''
									}
									isRequired={true}
									disabled={pending}
									onChange={(e) =>
										handleContentChange(
											language,
											'name',
											e.target.value,
										)
									}
									error={
										contentIndex >= 0
											? errors.contents?.[contentIndex]
													?.name
											: undefined
									}
								/>

								<FormComponentInput<PlaceContent>
									id={`${elementIds.contents}-${language}-type_label`}
									labelText="Type Label"
									fieldName="type_label"
									fieldValue={
										contentsMap[language]?.type_label ?? ''
									}
									isRequired={true}
									disabled={pending}
									onChange={(e) =>
										handleContentChange(
											language,
											'type_label',
											e.target.value,
										)
									}
									error={
										contentIndex >= 0
											? errors.contents?.[contentIndex]
													?.type_label
											: undefined
									}
								/>
							</div>
						</TabsContent>
					);
				})}
			</Tabs>
		</>
	);
}
