import type { JSX } from 'react';
import {
	FormComponentCheckbox,
	FormComponentInput,
	FormComponentRadio,
	FormComponentSelect,
	type OptionsType,
} from '@/components/form/form-element.component';
import { Icons } from '@/components/icon.component';
import { Button } from '@/components/ui/button';
import { getLanguageClient } from '@/config/translate.setup';
import { requestUpdate } from '@/helpers/services.helper';
import { hasPermission } from '@/models/account.model';
import {
	displayAttributeLabel,
	emptyAttributeValue,
	MEASURE_UNIT_SYMBOLS,
	type ProductAttributeFormType,
	type ProductCategoryAttributeModel,
	ProductCategoryAttributeTypeEnum,
	ProductCategoryAttributeValueTypeEnum,
} from '@/models/product-category-attribute.model';
import {
	displayTermValue,
	type TermModel,
	TermTypeEnum,
} from '@/models/term.model';
import { useAuth } from '@/providers/auth.provider';
import { useModalStore } from '@/stores/window.store';
import { DataSourceSectionEnum } from '@/types/data-source.type';

type Props = {
	definitions: ProductCategoryAttributeModel[];
	values: ProductAttributeFormType[];
	onChange: (values: ProductAttributeFormType[]) => void;
	/**
	 * Keyed by `attribute_label_id`, since that is what a definition is addressed by everywhere
	 * else — the index in the list is not stable across a category change.
	 */
	errors?: Record<number, string[] | undefined>;
	disabled: boolean;
	/**
	 * Namespaces the element ids. The variant editor renders this once per row, so a bare
	 * `attribute-8` would repeat across rows and every label would point at the first one.
	 */
	idPrefix: string;
	/**
	 * Called once a new admissible value has been added to a definition. The resolved form is
	 * the host's — it holds the query — so this only says that it is stale.
	 */
	onDefinitionsChanged?: () => void;
};

/**
 * What follows the value: the definition's unit symbol, or the affix it carries instead. Never
 * both — the table forbids it, since two answers to what trails a number is one too many.
 */
function displayValueSuffix(
	definition: ProductCategoryAttributeModel,
): string | null {
	if (definition.unit) {
		return MEASURE_UNIT_SYMBOLS[definition.unit] ?? definition.unit;
	}

	return definition.suffix;
}

/** How far apart the offer order places consecutive options. */
const OPTION_SORT_STEP = 10;

/** The admissible values as select/radio options, in the order the definition offers them. */
function toOptions(
	definition: ProductCategoryAttributeModel,
	language: ReturnType<typeof getLanguageClient>,
): OptionsType {
	return (definition.options ?? []).map((option) => ({
		label: option.term
			? displayTermValue(option.term, language, `#${option.term_id}`)
			: `#${option.term_id}`,
		value: String(option.term_id),
	}));
}

/**
 * The fields a product (or one of its variants) answers, rendered from the definitions its
 * categories declare.
 *
 * Nothing here decides *which* definitions apply — that walk is the backend's, answered by
 * `resolve`. This only draws them, keyed on the pairing of `type` (how the value is captured)
 * and `value_type` (where it is stored), which the table's own check constrains to the
 * combinations handled below.
 */
export function FormAttributesProduct({
	definitions,
	values,
	onChange,
	errors,
	disabled,
	idPrefix,
	onDefinitionsChanged,
}: Props): JSX.Element | null {
	const language = getLanguageClient();

	const { auth } = useAuth();
	const { open, focus, getCurrentWindow } = useModalStore();

	// Adding a value writes a `term` and then the definition that offers it, so it takes both
	const canAddValue =
		hasPermission(auth, 'term', 'create') &&
		hasPermission(auth, 'product', 'update');

	if (definitions.length === 0) {
		return null;
	}

	const byLabel = new Map(
		values.map((value) => [value.attribute_label_id, value]),
	);

	const update = (
		definition: ProductCategoryAttributeModel,
		patch: Partial<ProductAttributeFormType>,
	) => {
		const current =
			byLabel.get(definition.attribute_label_id) ??
			emptyAttributeValue(definition);

		/*
		 * The definition's storage is restamped on every edit: a category change can swap the
		 * definition under a label that already has an answer, and a stale `value_type` would
		 * send the old column for the new field.
		 */
		const next = {
			...current,
			value_type: definition.value_type,
			...patch,
		};

		onChange([
			...values.filter(
				(value) =>
					value.attribute_label_id !== definition.attribute_label_id,
			),
			next,
		]);
	};

	/**
	 * Adds a value the list does not offer yet.
	 *
	 * Two writes, in this order: the wording becomes an `attribute_value` term — a record other
	 * products point at too, so a rename corrects them all — and the definition is then updated
	 * to offer it. The definition owns the list, so the option cannot be created on its own.
	 *
	 * `open` minimizes this form to make room, so the parent is captured beforehand and focused
	 * again once the term exists.
	 */
	const addValue = (definition: ProductCategoryAttributeModel) => {
		const parentWindow = getCurrentWindow();

		open({
			minimized: false,
			section: DataSourceSectionEnum.DASHBOARD,
			dataSource: 'term',
			action: 'create',
			data: {
				prefillEntry: { type: TermTypeEnum.ATTRIBUTE_VALUE },
			},
			events: {
				success: async (entry?: TermModel) => {
					if (parentWindow) {
						focus(parentWindow.uid);
					}

					if (!entry) {
						return;
					}

					const existing = definition.options ?? [];

					// Appended at the end of the offer order, clear of the ones already placed
					const sortOrder =
						existing.reduce(
							(highest, option) =>
								Math.max(highest, option.sort_order),
							0,
						) + OPTION_SORT_STEP;

					await requestUpdate(
						'product-category-attribute',
						{
							options: [
								...existing.map((option) => ({
									term_id: option.term_id,
									sort_order: option.sort_order,
								})),
								{ term_id: entry.id, sort_order: sortOrder },
							],
						},
						definition.id,
					);

					onDefinitionsChanged?.();
				},
			},
		});
	};

	return (
		<div className="form-section">
			{definitions.map((definition) => {
				const labelId = definition.attribute_label_id;
				const value =
					byLabel.get(labelId) ?? emptyAttributeValue(definition);
				const id = `${idPrefix}-attribute-${labelId}`;
				const error = errors?.[labelId];
				const labelText = displayAttributeLabel(definition, language);
				const suffix = displayValueSuffix(definition);

				// The unit reads as part of the question rather than as decoration on the
				// answer — the input holds a bare number, which is what keeps it filterable
				const withSuffix = suffix
					? `${labelText} (${suffix})`
					: labelText;

				if (
					definition.value_type ===
					ProductCategoryAttributeValueTypeEnum.BOOLEAN
				) {
					return (
						<FormComponentCheckbox<ProductAttributeFormType>
							key={labelId}
							id={id}
							fieldName="boolean"
							checked={value.boolean}
							disabled={disabled}
							error={error}
							onCheckedChange={(checked) =>
								update(definition, { boolean: checked })
							}
						>
							{labelText}
						</FormComponentCheckbox>
					);
				}

				if (
					definition.value_type ===
					ProductCategoryAttributeValueTypeEnum.TERM
				) {
					const options = toOptions(definition, language);

					/*
					 * Offered under every term-backed field: the admissible values are a list
					 * someone curated in advance, and the moment it is short the editor is stuck
					 * with no way forward from here. Adding one widens the definition, so it
					 * shows for every product under that category from then on.
					 */
					const addValueControl = canAddValue ? (
						<Button
							type="button"
							variant="ghost"
							hover="success"
							disabled={disabled}
							onClick={() => addValue(definition)}
							className="p-1 text-xs opacity-70 hover:opacity-100"
							title={`Add a value to "${labelText}"`}
						>
							<Icons.Action.Add className="h-3.5 w-3.5" /> Add
							value
						</Button>
					) : null;

					if (
						definition.type ===
						ProductCategoryAttributeTypeEnum.CHECKBOX
					) {
						/*
						 * The one capture that admits several answers: each ticked term becomes
						 * its own row, which is what the `(product, label, value_term_id)`
						 * unique index is for and what keeps every choice filterable on its own.
						 */
						return (
							<fieldset key={labelId} className="space-y-1">
								<legend className="label-placeholder">
									{labelText}
									{definition.is_required && (
										<span className="text-danger ml-1">
											*
										</span>
									)}
								</legend>

								{options.map((option) => {
									const termId = Number(option.value);
									const checked = value.terms.some(
										(term) => term.id === termId,
									);

									return (
										<FormComponentCheckbox<ProductAttributeFormType>
											key={option.value}
											id={`${id}-${option.value}`}
											fieldName="terms"
											checked={checked}
											disabled={disabled}
											onCheckedChange={(next) =>
												update(definition, {
													terms: next
														? [
																...value.terms,
																{ id: termId },
															]
														: value.terms.filter(
																(term) =>
																	term.id !==
																	termId,
															),
												})
											}
										>
											{option.label}
										</FormComponentCheckbox>
									);
								})}

								{addValueControl}

								{error?.length ? (
									<p className="text-sm text-danger">
										{error.join(' ')}
									</p>
								) : null}
							</fieldset>
						);
					}

					if (
						definition.type ===
						ProductCategoryAttributeTypeEnum.RADIO
					) {
						return (
							<div key={labelId} className="space-y-1">
								<FormComponentRadio<ProductAttributeFormType>
									labelText={labelText}
									id={id}
									fieldName="terms"
									fieldValue={
										value.terms[0]
											? String(value.terms[0].id)
											: null
									}
									isRequired={definition.is_required}
									disabled={disabled}
									error={error}
									options={options}
									onChange={(next) =>
										update(definition, {
											terms: next
												? [{ id: Number(next) }]
												: [],
										})
									}
								/>
								{addValueControl}
							</div>
						);
					}

					return (
						<div key={labelId} className="space-y-1">
							<FormComponentSelect<ProductAttributeFormType>
								labelText={labelText}
								id={id}
								fieldName="terms"
								fieldValue={
									value.terms[0]
										? String(value.terms[0].id)
										: ''
								}
								isRequired={definition.is_required}
								disabled={disabled}
								error={error}
								options={options}
								onChange={(next) =>
									update(definition, {
										terms: next
											? [{ id: Number(next) }]
											: [],
									})
								}
							/>
							{addValueControl}
						</div>
					);
				}

				return (
					<FormComponentInput<ProductAttributeFormType>
						key={labelId}
						labelText={withSuffix}
						id={id}
						fieldName="text"
						fieldValue={value.text}
						isRequired={definition.is_required}
						disabled={disabled}
						error={error}
						placeholderText={
							definition.prefix ? `${definition.prefix} …` : ''
						}
						onChange={(event) =>
							update(definition, { text: event.target.value })
						}
					/>
				);
			})}
		</div>
	);
}
