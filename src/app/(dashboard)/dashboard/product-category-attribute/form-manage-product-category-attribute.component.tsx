'use client';

import { useMemo, useState } from 'react';
import type { ProductCategoryAttributeFormValuesType } from '@/app/(dashboard)/dashboard/product-category-attribute/product-category-attribute.definition';
import {
	FormComponentAutoComplete,
	FormComponentCheckbox,
	FormComponentInput,
	FormComponentSelect,
	type GroupedOptionsType,
} from '@/components/form/form-element.component';
import { FormPickerRefs } from '@/components/form/form-picker-refs.component';
import { Icons } from '@/components/icon.component';
import { getLanguageClient } from '@/config/translate.setup';
import { toOptionsFromEnum } from '@/helpers/form.helper';
import { requestFind } from '@/helpers/services.helper';
import {
	capitalizeFirstLetter,
	enumTranslationKeys,
	replaceVars,
	translateEnumLabel,
} from '@/helpers/string.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useRemoteAutocomplete } from '@/hooks/use-remote-autocomplete';
import { useTranslation } from '@/hooks/use-translation.hook';
import { hasPermission } from '@/models/account.model';
import {
	MEASURE_DIMENSION_KEYS,
	MEASURE_UNIT_GROUPS,
	type MeasureUnit,
	type ProductCategoryAttributeScope,
	ProductCategoryAttributeScopeEnum,
	type ProductCategoryAttributeType,
	ProductCategoryAttributeTypeEnum,
	type ProductCategoryAttributeValueType,
	ProductCategoryAttributeValueTypeEnum,
	VALUE_TYPES_BY_TYPE,
} from '@/models/product-category-attribute.model';
import {
	displayTermValue,
	type TermModel,
	TermTypeEnum,
} from '@/models/term.model';
import { useAuth } from '@/providers/auth.provider';
import { useWindowForm } from '@/providers/window-form.provider';
import { useModalStore } from '@/stores/window.store';
import type { FindFunctionResponseType } from '@/types/action.type';
import type { Language } from '@/types/common.type';
import { DataSourceSectionEnum } from '@/types/data-source.type';

const TRANSLATION_KEYS = [
	'product-category-attribute.field.attribute_label',
	'product-category-attribute.field.category_id',
	'product-category-attribute.field.inherit',
	'product-category-attribute.field.is_filterable',
	'product-category-attribute.field.is_required',
	'product-category-attribute.field.max_value',
	'product-category-attribute.field.min_value',
	'product-category-attribute.field.options',
	'product-category-attribute.field.prefix',
	'product-category-attribute.field.scope',
	'product-category-attribute.field.suffix',
	'product-category-attribute.field.type',
	'product-category-attribute.field.unit',
	'product-category-attribute.field.value_type',
	'product-category-attribute.text.a_list_has_to_offer_something',
	'product-category-attribute.text.placeholder_max_value',
	'product-category-attribute.text.placeholder_min_value',
	'product-category-attribute.text.placeholder_prefix',
	'product-category-attribute.text.placeholder_suffix',
	'product-category-attribute.text.create_attribute_label',
	'product-category-attribute.text.create_value',
	...enumTranslationKeys(
		'product-category-attribute.enum.scope',
		ProductCategoryAttributeScopeEnum,
	),
	...enumTranslationKeys(
		'product-category-attribute.enum.type',
		ProductCategoryAttributeTypeEnum,
	),
	...enumTranslationKeys(
		'product-category-attribute.enum.value_type',
		ProductCategoryAttributeValueTypeEnum,
	),
	...MEASURE_DIMENSION_KEYS,
] as const;

/**
 * A label term as the form shows it. The wording is stored lower-cased on purpose - see
 * `displayAttributeLabel`, which capitalises the same way everywhere else the label is drawn.
 */
function displayAttributeTerm(entry: TermModel, language: Language): string {
	return capitalizeFirstLetter(displayTermValue(entry, language));
}

export function FormManageProductCategoryAttribute() {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	/** The units, grouped by what they measure - a flat list of twenty-five reads as noise. */
	const unitOptions: GroupedOptionsType = useMemo(
		() =>
			MEASURE_UNIT_GROUPS.map((group) => ({
				label: translations[group.dimensionKey],
				options: group.units.map((unit) => ({
					label: unit.symbol,
					value: unit.value,
				})),
			})),
		[translations],
	);

	const captureTypes = useMemo(
		() =>
			toOptionsFromEnum(ProductCategoryAttributeTypeEnum, {
				formatter: (value) =>
					translateEnumLabel(
						translations,
						'product-category-attribute.enum.type',
						value,
					),
			}),
		[translations],
	);

	const scopes = useMemo(
		() =>
			toOptionsFromEnum(ProductCategoryAttributeScopeEnum, {
				formatter: (value) =>
					translateEnumLabel(
						translations,
						'product-category-attribute.enum.scope',
						value,
					),
			}),
		[translations],
	);

	const { formOperation, formValues, errors, handleChange, pending } =
		useWindowForm<ProductCategoryAttributeFormValuesType>();

	const { open, focus, getCurrentWindow } = useModalStore();
	const { auth } = useAuth();

	// Both pickers create a `term`. Offering that without the permission would only defer the
	// refusal to the submit of the window they open.
	const canCreateTerm = hasPermission(auth, 'term', 'create');

	/*
	 * The category and the label are create-only: the backend's `update` schema takes neither,
	 * and a definition that could move between them would be a different definition wearing the
	 * same id. The values a product records point at the *label*, not at this row, so moving one
	 * would silently reinterpret every value already stored under it.
	 */
	const isCreate = formOperation === 'create';

	const language = getLanguageClient();

	const elementIds = useElementIds([
		'category_id',
		'attribute_label',
		'scope',
		'type',
		'value_type',
		'unit',
		'prefix',
		'suffix',
		'min_value',
		'max_value',
		'is_required',
		'is_filterable',
		'inherit',
	] as const);

	const [searchLabel, setSearchLabel] = useState('');

	const { suggestions: labelSuggestions, isFetching: isLabelFetching } =
		useRemoteAutocomplete<TermModel>({
			query: searchLabel,
			queryKey: ['s-attribute-label', language],
			queryFn: async (query) => {
				const response:
					| FindFunctionResponseType<TermModel>
					| undefined = await requestFind('term', {
					filter: {
						term: query,
						// `attribute_label_id` is a plain foreign key to `term`, so the backend
						// accepts any row - unfiltered the picker offers the tags and the
						// attribute *values* too, and a definition ends up labelled "red".
						type: TermTypeEnum.ATTRIBUTE_LABEL,
						language,
					},
					limit: 10,
				});

				return response?.entries ?? [];
			},
			minLength: 3,
		});

	const isNumber =
		formValues.value_type === ProductCategoryAttributeValueTypeEnum.NUMBER;
	const isTerm =
		formValues.value_type === ProductCategoryAttributeValueTypeEnum.TERM;

	/** Only the storages this capture admits - the rest fail the table's own check. */
	const valueTypeOptions = VALUE_TYPES_BY_TYPE[formValues.type].map(
		(valueType) => ({
			label: translateEnumLabel(
				translations,
				'product-category-attribute.enum.value_type',
				valueType,
			),
			value: valueType,
		}),
	);

	/**
	 * Storage decides which of the remaining fields mean anything, so the ones it rules out are
	 * emptied as it changes rather than left behind: a bound kept from a numeric attribute is
	 * refused on save, and an option list kept from a list-backed one is wiped by the sync
	 * without ever being shown again.
	 */
	const applyValueType = (valueType: ProductCategoryAttributeValueType) => {
		handleChange('value_type', valueType);

		if (valueType !== ProductCategoryAttributeValueTypeEnum.NUMBER) {
			handleChange('unit', null);
			handleChange('min_value', '');
			handleChange('max_value', '');
		}

		if (valueType !== ProductCategoryAttributeValueTypeEnum.TERM) {
			handleChange('options', []);
		}
	};

	/**
	 * Creating the label from here, because defining an attribute usually means naming one for
	 * the first time. `open` minimizes this form, so it is captured beforehand and focused again
	 * on success - otherwise the editor lands on an empty desktop with a half-filled form parked
	 * in the dock.
	 */
	const createLabelTerm = (typedValue: string) => {
		const parentWindow = getCurrentWindow();

		open({
			minimized: false,
			section: DataSourceSectionEnum.DASHBOARD,
			dataSource: 'term',
			action: 'create',
			data: {
				prefillEntry: {
					type: TermTypeEnum.ATTRIBUTE_LABEL,
					contents: [{ language, value: typedValue }],
				},
			},
			events: {
				success: async (entry?: TermModel) => {
					if (parentWindow) {
						focus(parentWindow.uid);
					}

					if (!entry) {
						return;
					}

					handleChange('attribute_label_id', entry.id);
					handleChange(
						'attribute_label',
						displayAttributeTerm(entry, language),
					);
					setSearchLabel('');
				},
			},
		});
	};

	return (
		<>
			<input
				type="hidden"
				name="category_id"
				value={formValues.category_id ?? ''}
			/>
			<input
				type="hidden"
				name="category_options"
				value={JSON.stringify(formValues.category_options)}
			/>
			{/*
			 * Carried, not offered. The order among a category's attributes is arranged by
			 * dragging them in the category's attribute manager, so there is nothing to type
			 * here - but `getFormValues` reads the payload off the DOM, and a field with no
			 * input in the form reaches it as absent and submits as 0. On create this holds the
			 * position the manager assigned; on update, the row's existing one.
			 */}
			<input
				type="hidden"
				name="sort_order"
				value={formValues.sort_order}
			/>

			{/*
			 * Only when the caller offered a choice. Opened from a category, the answer is that
			 * category and the field would be a select of one; opened from a product, it is the
			 * one thing the product form cannot decide - a definition belongs to exactly one
			 * category, and which of the product's should carry it is an editorial call.
			 */}
			{isCreate && formValues.category_options.length > 0 && (
				<FormComponentSelect<ProductCategoryAttributeFormValuesType>
					labelText={
						translations[
							'product-category-attribute.field.category_id'
						]
					}
					id={elementIds.category_id}
					fieldName="category_id"
					fieldValue={
						formValues.category_id
							? String(formValues.category_id)
							: ''
					}
					isRequired={true}
					disabled={pending}
					options={formValues.category_options.map((option) => ({
						label: option.label,
						value: String(option.id),
					}))}
					onChange={(value) =>
						handleChange(
							'category_id',
							value ? Number(value) : null,
						)
					}
					error={errors.category_id}
				/>
			)}
			<input
				type="hidden"
				name="attribute_label_id"
				value={formValues.attribute_label_id ?? ''}
			/>

			<div className="form-section">
				<FormComponentAutoComplete<
					ProductCategoryAttributeFormValuesType,
					TermModel
				>
					labelText={
						translations[
							'product-category-attribute.field.attribute_label'
						]
					}
					id={elementIds.attribute_label}
					fieldName="attribute_label"
					fieldValue={formValues.attribute_label ?? ''}
					className="pl-8"
					isRequired={true}
					disabled={pending || !isCreate}
					// The id is what the row stores; the text is only how it was found, so a
					// label typed but never picked has to report itself against this field.
					error={errors.attribute_label_id}
					onInputChange={(value) => {
						handleChange('attribute_label', value);
						handleChange('attribute_label_id', null);
						setSearchLabel(value);
					}}
					autoCompleteProps={{
						suggestions: labelSuggestions,
						isLoading: isLabelFetching,
						onSelect: (entry) => {
							handleChange('attribute_label_id', entry.id);
							handleChange(
								'attribute_label',
								displayAttributeTerm(entry, language),
							);
							setSearchLabel('');
						},
						getOptionLabel: (entry) =>
							displayAttributeTerm(entry, language),
						getOptionKey: (entry) => entry.id,
						allowCreate: isCreate && canCreateTerm,
						onCreate: createLabelTerm,
						createLabel: (value) =>
							replaceVars(
								translations[
									'product-category-attribute.text.create_attribute_label'
								],
								{ value: value },
							),
					}}
					icons={{
						left: <Icons.Tag className="opacity-40 h-4.5 w-4.5" />,
					}}
				/>

				<FormComponentSelect<ProductCategoryAttributeFormValuesType>
					labelText={
						translations['product-category-attribute.field.scope']
					}
					id={elementIds.scope}
					fieldName="scope"
					fieldValue={formValues.scope}
					disabled={pending}
					options={scopes}
					onChange={(value) =>
						handleChange(
							'scope',
							value as ProductCategoryAttributeScope,
						)
					}
					error={errors.scope}
				/>
			</div>

			<div className="form-section">
				<FormComponentSelect<ProductCategoryAttributeFormValuesType>
					labelText={
						translations['product-category-attribute.field.type']
					}
					id={elementIds.type}
					fieldName="type"
					fieldValue={formValues.type}
					disabled={pending}
					options={captureTypes}
					onChange={(value) => {
						const type = value as ProductCategoryAttributeType;

						handleChange('type', type);

						// A capture admits only some storages, so one it no longer allows is
						// moved to the first it does rather than left to fail on save.
						if (
							!VALUE_TYPES_BY_TYPE[type].includes(
								formValues.value_type,
							)
						) {
							applyValueType(VALUE_TYPES_BY_TYPE[type][0]);
						}
					}}
					error={errors.type}
				/>

				<FormComponentSelect<ProductCategoryAttributeFormValuesType>
					labelText={
						translations[
							'product-category-attribute.field.value_type'
						]
					}
					id={elementIds.value_type}
					fieldName="value_type"
					fieldValue={formValues.value_type}
					disabled={pending || valueTypeOptions.length === 1}
					options={valueTypeOptions}
					onChange={(value) =>
						applyValueType(
							value as ProductCategoryAttributeValueType,
						)
					}
					error={errors.value_type}
				/>
			</div>

			{isNumber && (
				<div className="form-section">
					<FormComponentSelect<ProductCategoryAttributeFormValuesType>
						labelText={
							translations[
								'product-category-attribute.field.unit'
							]
						}
						id={elementIds.unit}
						fieldName="unit"
						fieldValue={formValues.unit ?? ''}
						disabled={pending}
						options={unitOptions}
						searchable={true}
						onChange={(value) =>
							handleChange(
								'unit',
								(value || null) as MeasureUnit | null,
							)
						}
						error={errors.unit}
					/>

					{/*
					 * The bounds are quoted in the unit above, like the values they bound -
					 * the backend converts both through the same factor before comparing.
					 */}
					<FormComponentInput<ProductCategoryAttributeFormValuesType>
						labelText={
							translations[
								'product-category-attribute.field.min_value'
							]
						}
						id={elementIds.min_value}
						fieldName="min_value"
						fieldValue={formValues.min_value ?? ''}
						placeholderText={
							translations[
								'product-category-attribute.text.placeholder_min_value'
							]
						}
						disabled={pending}
						onChange={(event) =>
							handleChange('min_value', event.target.value)
						}
						error={errors.min_value}
					/>

					<FormComponentInput<ProductCategoryAttributeFormValuesType>
						labelText={
							translations[
								'product-category-attribute.field.max_value'
							]
						}
						id={elementIds.max_value}
						fieldName="max_value"
						fieldValue={formValues.max_value ?? ''}
						placeholderText={
							translations[
								'product-category-attribute.text.placeholder_max_value'
							]
						}
						disabled={pending}
						onChange={(event) =>
							handleChange('max_value', event.target.value)
						}
						error={errors.max_value}
					/>
				</div>
			)}

			<div className="form-section">
				<FormComponentInput<ProductCategoryAttributeFormValuesType>
					labelText={
						translations['product-category-attribute.field.prefix']
					}
					id={elementIds.prefix}
					fieldName="prefix"
					fieldValue={formValues.prefix ?? ''}
					placeholderText={
						translations[
							'product-category-attribute.text.placeholder_prefix'
						]
					}
					disabled={pending}
					onChange={(event) =>
						handleChange('prefix', event.target.value)
					}
					error={errors.prefix}
				/>

				{/*
				 * Decoration a measure does not cover - `pcs`, `%`. A unit renders in its place
				 * and converts; this one is a label and does not, so carrying both would leave
				 * two answers to what follows the number.
				 */}
				<FormComponentInput<ProductCategoryAttributeFormValuesType>
					labelText={
						translations['product-category-attribute.field.suffix']
					}
					id={elementIds.suffix}
					fieldName="suffix"
					fieldValue={formValues.suffix ?? ''}
					placeholderText={
						translations[
							'product-category-attribute.text.placeholder_suffix'
						]
					}
					disabled={pending || !!formValues.unit}
					onChange={(event) =>
						handleChange('suffix', event.target.value)
					}
					error={errors.suffix}
				/>
			</div>

			{isTerm && (
				<FormPickerRefs<TermModel>
					labelText={
						translations['product-category-attribute.field.options']
					}
					fieldName="options"
					dataSource="term"
					filter={{ type: TermTypeEnum.ATTRIBUTE_VALUE, language }}
					getOptionLabel={(entry) =>
						displayTermValue(entry, language)
					}
					entries={formValues.options.map((option) => ({
						id: option.term_id,
						label: option.label,
					}))}
					onSelect={(entry) =>
						handleChange('options', [
							...formValues.options,
							{
								term_id: entry.id,
								label: displayTermValue(entry, language),
							},
						])
					}
					onRemove={(id) =>
						handleChange(
							'options',
							formValues.options.filter(
								(option) => option.term_id !== id,
							),
						)
					}
					hiddenFields={
						<input
							type="hidden"
							name="options"
							value={JSON.stringify(formValues.options)}
						/>
					}
					queryKeyPrefix="s-attribute-value"
					emptyText={
						translations[
							'product-category-attribute.text.a_list_has_to_offer_something'
						]
					}
					// The set-wide rules report here; a single entry has no field of its own.
					error={errors.options_rule}
					isRequired={true}
					disabled={pending}
					create={
						canCreateTerm
							? {
									buildPrefillEntry: (typedValue) => ({
										type: TermTypeEnum.ATTRIBUTE_VALUE,
										contents: [
											{ language, value: typedValue },
										],
									}),
									createLabel: (typedValue) =>
										replaceVars(
											translations[
												'product-category-attribute.text.create_value'
											],
											{ value: typedValue },
										),
								}
							: undefined
					}
				/>
			)}

			<div className="form-section">
				<FormComponentCheckbox<ProductCategoryAttributeFormValuesType>
					id={elementIds.is_required}
					fieldName="is_required"
					checked={formValues.is_required}
					disabled={pending}
					onCheckedChange={(value) =>
						handleChange('is_required', value)
					}
				>
					{
						translations[
							'product-category-attribute.field.is_required'
						]
					}
				</FormComponentCheckbox>

				{/*
				 * What the storefront offers as a facet. The indexes cover every row either
				 * way, so this is a catalog decision rather than a performance one.
				 */}
				<FormComponentCheckbox<ProductCategoryAttributeFormValuesType>
					id={elementIds.is_filterable}
					fieldName="is_filterable"
					checked={formValues.is_filterable}
					disabled={pending}
					onCheckedChange={(value) =>
						handleChange('is_filterable', value)
					}
				>
					{
						translations[
							'product-category-attribute.field.is_filterable'
						]
					}
				</FormComponentCheckbox>

				{/*
				 * Governs the walk up the tree only - a category's own definitions always
				 * apply, and a child defining the same label overrides this one rather than
				 * adding a second control for it.
				 */}
				<FormComponentCheckbox<ProductCategoryAttributeFormValuesType>
					id={elementIds.inherit}
					fieldName="inherit"
					checked={formValues.inherit}
					disabled={pending}
					onCheckedChange={(value) => handleChange('inherit', value)}
				>
					{translations['product-category-attribute.field.inherit']}
				</FormComponentCheckbox>
			</div>
		</>
	);
}
