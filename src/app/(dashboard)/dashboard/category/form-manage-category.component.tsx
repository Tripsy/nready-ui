import { useState } from 'react';
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
	CATEGORY_DEFAULT_TYPE,
	type CategoryContentType,
	type CategoryModel,
	CategoryStatusEnum,
	type CategoryType,
	CategoryTypeEnum,
	displayCategoryLabel,
} from '@/models/category.model';
import { useWindowForm } from '@/providers/window-form.provider';
import type { FindFunctionResponseType } from '@/types/action.type';
import { type Language, LanguageEnum } from '@/types/common.type';
import type { PageMeta } from '@/types/page-meta.type';

export type CategoryFormValuesType = {
	type: CategoryType;
	parent_id: number | null;
	parent: string | null;

	contents: CategoryContentType[];
};

const languages = Object.values(LanguageEnum);

const categoryTypes = toOptionsFromEnum(CategoryTypeEnum, {
	formatter: formatEnumLabel,
});

export function FormManageCategory() {
	const { formOperation, formValues, errors, handleChange, pending } =
		useWindowForm<CategoryFormValuesType>();

	/*
	 * Type is create-only: the backend `update` schema accepts only `parent_id` and
	 * `contents`, and re-parenting across types is rejected — so it is fixed once the row
	 * exists. The parent itself is editable, which is why the type it scopes is not.
	 */
	const isCreate = formOperation === 'create';

	const elementIds = useElementIds(['type', 'parent', 'contents'] as const);

	const [selectedLanguage, setSelectedLanguage] = useState<Language>(
		getLanguageClient(),
	);
	const [searchParentCategories, setSearchParentCategories] = useState('');

	const {
		suggestions: parentCategorySuggestions,
		isFetching: isParentCategoryFetching,
	} = useRemoteAutocomplete<CategoryModel>({
		query: searchParentCategories,
		queryKey: ['s-parent-category', formValues.type, selectedLanguage],
		queryFn: async (q) => {
			const res: FindFunctionResponseType<CategoryModel> | undefined =
				await requestFind('category', {
					filter: {
						term: q,
						// A parent must share the child's type and be usable as one, so the
						// suggestion list is scoped the same way the backend validates it.
						type: formValues.type,
						status: CategoryStatusEnum.ACTIVE,
						/*
						 * Drops categories already at their type's depth limit
						 * (article: parent > category, product: parent > category >
						 * sub-category). It answers for a single new child, so moving an
						 * existing category that carries children of its own can still be
						 * refused on save — the service is the gate, this only keeps the
						 * obvious dead ends out of the list.
						 */
						can_parent: true,
						language: selectedLanguage,
					},
					limit: 10,
				});

			return res?.entries ?? [];
		},
		minLength: 3,
	});

	// Derive map from formValues
	const [contentsMap, setContentsMap] = useState<
		Partial<Record<Language, CategoryContentType>>
	>(
		() =>
			Object.fromEntries(
				(formValues.contents ?? []).map((c) => [c.language, c]),
			) as Partial<Record<Language, CategoryContentType>>,
	);

	const syncContents = (
		updated: Partial<Record<Language, CategoryContentType>>,
	) => {
		setContentsMap(updated);

		// Sync back to formValues as array
		handleChange(
			'contents',
			Object.values(updated).filter((c): c is CategoryContentType => !!c),
		);
	};

	const handleContentChange = (
		language: Language,
		field: keyof CategoryContentType,
		value: string,
	) => {
		syncContents({
			...contentsMap,
			[language]: {
				...contentsMap[language],
				language,
				[field]: value,
			},
		});
	};

	const handleMetaChange = (
		language: Language,
		field: keyof PageMeta,
		value: string,
	) => {
		syncContents({
			...contentsMap,
			[language]: {
				...contentsMap[language],
				language,
				meta: {
					...contentsMap[language]?.meta,
					[field]: value,
				},
			},
		});
	};

	return (
		<>
			<FormComponentRadio<CategoryFormValuesType>
				labelText="Type"
				id={elementIds.type}
				fieldName="type"
				fieldValue={formValues.type ?? CATEGORY_DEFAULT_TYPE}
				options={categoryTypes}
				disabled={pending || !isCreate}
				onChange={(value) => {
					handleChange('type', value as CategoryType);
					// The parent must match the new type, so a stale selection is dropped
					handleChange('parent', null);
					handleChange('parent_id', null);
					setSearchParentCategories('');
				}}
				error={errors.type}
			/>

			<input
				type="hidden"
				name="parent_id"
				value={formValues.parent_id ?? ''}
			/>
			<FormComponentAutoComplete<CategoryFormValuesType, CategoryModel>
				labelText="Parent"
				id={elementIds.parent}
				fieldName="parent"
				fieldValue={formValues.parent ?? ''}
				className="pl-8"
				isRequired={false}
				disabled={pending}
				error={errors.parent}
				// Clearing the field is how a category is promoted to a root, so an empty
				// input is a valid value here, not an unfinished selection.
				onInputChange={(value) => {
					handleChange('parent', value);
					handleChange('parent_id', null);
					setSearchParentCategories(value);
				}}
				autoCompleteProps={{
					suggestions: parentCategorySuggestions,
					isLoading: isParentCategoryFetching,
					onSelect: (m) => {
						handleChange(
							'parent',
							displayCategoryLabel(m, selectedLanguage, false),
						);
						handleChange('parent_id', m.id);
					},
					getOptionLabel: (m) =>
						displayCategoryLabel(m, selectedLanguage, false),
					getOptionKey: (m) => m.id,
				}}
				icons={{
					left: <Icons.Category className="opacity-40 h-4.5 w-4.5" />,
				}}
			/>

			<input
				type="hidden"
				name="contents"
				value={JSON.stringify(
					Object.values(formValues.contents).filter(
						Boolean,
					) as CategoryContentType[],
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
								<FormComponentInput<CategoryContentType>
									id={`${elementIds.contents}-${language}-label`}
									labelText="Label"
									fieldName="label"
									fieldValue={
										contentsMap[language]?.label ?? ''
									}
									isRequired={true}
									placeholderText="eg: Travel guides"
									disabled={pending}
									onChange={(e) =>
										handleContentChange(
											language,
											'label',
											e.target.value,
										)
									}
									error={
										contentIndex >= 0
											? errors.contents?.[contentIndex]
													?.label
											: undefined
									}
								/>

								<FormComponentInput<CategoryContentType>
									id={`${elementIds.contents}-${language}-slug`}
									labelText="Slug"
									fieldName="slug"
									fieldValue={
										contentsMap[language]?.slug ?? ''
									}
									placeholderText="Derived from the label when left empty"
									disabled={pending}
									onChange={(e) =>
										handleContentChange(
											language,
											'slug',
											e.target.value,
										)
									}
									error={
										contentIndex >= 0
											? errors.contents?.[contentIndex]
													?.slug
											: undefined
									}
								/>

								<FormComponentInput<CategoryContentType>
									id={`${elementIds.contents}-${language}-description`}
									labelText="Description"
									fieldName="description"
									fieldValue={
										contentsMap[language]?.description ?? ''
									}
									isRequired={true}
									disabled={pending}
									onChange={(e) =>
										handleContentChange(
											language,
											'description',
											e.target.value,
										)
									}
									error={
										contentIndex >= 0
											? errors.contents?.[contentIndex]
													?.description
											: undefined
									}
								/>

								<FormComponentInput<PageMeta>
									id={`${elementIds.contents}-${language}-meta-title`}
									labelText="Meta Title"
									fieldName="title"
									fieldValue={
										contentsMap[language]?.meta?.title ?? ''
									}
									disabled={pending}
									onChange={(e) =>
										handleMetaChange(
											language,
											'title',
											e.target.value,
										)
									}
									error={
										contentIndex >= 0
											? errors.contents?.[contentIndex]
													?.meta?.title
											: undefined
									}
								/>

								<FormComponentInput<PageMeta>
									id={`${elementIds.contents}-${language}-meta-description`}
									labelText="Meta Description"
									fieldName="description"
									fieldValue={
										contentsMap[language]?.meta
											?.description ?? ''
									}
									disabled={pending}
									onChange={(e) =>
										handleMetaChange(
											language,
											'description',
											e.target.value,
										)
									}
									error={
										contentIndex >= 0
											? errors.contents?.[contentIndex]
													?.meta?.description
											: undefined
									}
								/>

								<FormComponentInput<PageMeta>
									id={`${elementIds.contents}-${language}-meta-keywords`}
									labelText="Meta Keywords"
									fieldName="keywords"
									fieldValue={
										contentsMap[language]?.meta?.keywords ??
										''
									}
									disabled={pending}
									onChange={(e) =>
										handleMetaChange(
											language,
											'keywords',
											e.target.value,
										)
									}
									error={
										contentIndex >= 0
											? errors.contents?.[contentIndex]
													?.meta?.keywords
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
