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
import { cn } from '@/helpers/css.helper';
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
	 * else - the index in the list is not stable across a category change.
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
	 * the host's - it holds the query - so this only says that it is stale.
	 */
	onDefinitionsChanged?: () => void;
};

/**
 * What follows the value: the definition's unit symbol, or the affix it carries instead. Never
 * both - the table forbids it, since two answers to what trails a number is one too many.
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

/**
 * The three columns every attribute row occupies: the question, the answer, and the control that
 * widens the answer list.
 *
 * Declared here rather than per row, with each row a `subgrid` of it, so the fields and the "Add
 * value" buttons line up down the whole panel - a row whose definition has no button leaves that
 * cell empty instead of reclaiming the width and pulling its own field out of line with the rest.
 *
 * `grid` overrides the `flex flex-col` that `.form-section` carries: that rule sits in the
 * components layer and this is a utility, so ordering settles it. The class is kept because the
 * error tooltips are positioned by `.form-section .form-element .form-element-error` - drop it
 * and every error renders as a static block instead.
 *
 * One column below `sm`, where a three-way split leaves the field nothing usable. Stated
 * explicitly rather than left implicit: a `subgrid` row inherits only the tracks its parent
 * *declares*, and with none to inherit it would open implicit columns of its own and lay the
 * three cells out side by side - the opposite of the stack the narrow width needs.
 */
const ATTRIBUTE_GRID =
	'form-section grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto]';

const ATTRIBUTE_ROW = 'grid grid-cols-subgrid col-span-full gap-x-4 gap-y-1';

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
 * Nothing here decides *which* definitions apply - that walk is the backend's, answered by
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
	 * Two writes, in this order: the wording becomes an `attribute_value` term - a record other
	 * products point at too, so a rename corrects them all - and the definition is then updated
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
		<div className={ATTRIBUTE_GRID}>
			{definitions.map((definition) => {
				const labelId = definition.attribute_label_id;
				const value =
					byLabel.get(labelId) ?? emptyAttributeValue(definition);
				const id = `${idPrefix}-attribute-${labelId}`;
				const error = errors?.[labelId];
				const labelText = displayAttributeLabel(definition, language);
				const suffix = displayValueSuffix(definition);

				const isBoolean =
					definition.value_type ===
					ProductCategoryAttributeValueTypeEnum.BOOLEAN;

				const isTerm =
					definition.value_type ===
					ProductCategoryAttributeValueTypeEnum.TERM;

				/*
				 * Number and string, the pairing the two above leave - and the only one whose
				 * value a unit or an affix trails. The table lets a term-backed or boolean
				 * definition carry a `suffix` too (it only forbids pairing one with a `unit`),
				 * but there is no figure for it to follow there.
				 */
				const isTextual = !isBoolean && !isTerm;

				// The one capture that admits several answers: each ticked term becomes its own
				// row, which is what the `(product, label, value_term_id)` unique index is for
				// and what keeps every choice filterable on its own.
				const isMultiple =
					isTerm &&
					definition.type ===
						ProductCategoryAttributeTypeEnum.CHECKBOX;

				const options = isTerm ? toOptions(definition, language) : [];

				// The unit reads as part of the question rather than as decoration on the
				// answer - the input holds a bare number, which is what keeps it filterable
				const questionText =
					suffix && isTextual
						? `${labelText} (${suffix})`
						: labelText;

				/*
				 * Offered under every term-backed field: the admissible values are a list someone
				 * curated in advance, and the moment it is short the editor is stuck with no way
				 * forward from here. Adding one widens the definition, so it shows for every
				 * product under that category from then on.
				 */
				const addValueControl =
					isTerm && canAddValue ? (
						<Button
							type="button"
							variant="ghost"
							hover="success"
							disabled={disabled}
							onClick={() => addValue(definition)}
							className="whitespace-nowrap p-2 text-xs opacity-70 hover:opacity-100"
							title={`Add a value to "${labelText}"`}
						>
							<Icons.Action.Add className="h-3.5 w-3.5" />
							Add value
						</Button>
					) : null;

				/*
				 * The label is rendered here rather than by the field, which is what puts it
				 * beside the answer instead of above it. Every field is then named by
				 * `ariaLabel` - a native `<label for>` would give the text input click-to-focus,
				 * but it names only that one control: the select is a react-aria trigger and the
				 * option lists have no single control to point at, so they would still need
				 * `ariaLabel` and the two branches would drift.
				 */
				let control: JSX.Element;

				if (isBoolean) {
					control = (
						<FormComponentCheckbox<ProductAttributeFormType>
							id={id}
							fieldName="boolean"
							checked={value.boolean}
							disabled={disabled}
							error={error}
							ariaLabel={labelText}
							onCheckedChange={(checked) =>
								update(definition, { boolean: checked })
							}
						/>
					);
				} else if (isMultiple) {
					control = (
						<div>
							{/*
							 * A `<fieldset>` carrying `aria-label` rather than a `<legend>`:
							 * the question is rendered in the row's own label column, and a
							 * legend cannot be lifted out of the element it names.
							 *
							 * Kept as a bare wrapper with the row on the div inside it. The
							 * preflight reset strips a fieldset's default margin, padding and
							 * border, so it costs no space - but it is left a block, clear of
							 * the `display: flex` a fieldset has a long history of mishandling.
							 */}
							<fieldset aria-label={labelText}>
								<div className="flex flex-wrap items-center gap-x-4 gap-y-1">
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
																	{
																		id: termId,
																	},
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
								</div>
							</fieldset>

							{/*
							 * Reported here rather than through the field's own tooltip: the
							 * error belongs to the set, and there is no single `.form-element`
							 * for it to hang off.
							 */}
							{error?.length ? (
								<p className="mt-1 text-sm text-danger">
									{error.join(' ')}
								</p>
							) : null}
						</div>
					);
				} else if (
					isTerm &&
					definition.type === ProductCategoryAttributeTypeEnum.RADIO
				) {
					control = (
						<FormComponentRadio<ProductAttributeFormType>
							id={id}
							fieldName="terms"
							fieldValue={
								value.terms[0]
									? String(value.terms[0].id)
									: null
							}
							disabled={disabled}
							error={error}
							options={options}
							ariaLabel={labelText}
							onChange={(next) =>
								update(definition, {
									terms: next ? [{ id: Number(next) }] : [],
								})
							}
						/>
					);
				} else if (isTerm) {
					control = (
						<FormComponentSelect<ProductAttributeFormType>
							id={id}
							fieldName="terms"
							fieldValue={
								value.terms[0] ? String(value.terms[0].id) : ''
							}
							disabled={disabled}
							error={error}
							options={options}
							ariaLabel={labelText}
							onChange={(next) =>
								update(definition, {
									terms: next ? [{ id: Number(next) }] : [],
								})
							}
						/>
					);
				} else {
					control = (
						<FormComponentInput<ProductAttributeFormType>
							id={id}
							fieldName="text"
							fieldValue={value.text}
							disabled={disabled}
							error={error}
							ariaLabel={questionText}
							placeholderText={
								definition.prefix
									? `${definition.prefix} …`
									: ''
							}
							onChange={(event) =>
								update(definition, { text: event.target.value })
							}
						/>
					);
				}

				const question = (
					<span className="text-sm font-semibold">
						{questionText}
						{definition.is_required && (
							<span className="ml-1 text-danger">*</span>
						)}
					</span>
				);

				return (
					<div
						key={labelId}
						className={cn(
							ATTRIBUTE_ROW,
							// A wrapping option list grows downwards, so its question stays at
							// the top of the row; every other answer is one line and centres
							isMultiple ? 'items-start' : 'items-center',
						)}
					>
						{question}

						<div>{control}</div>

						{addValueControl ? (
							<div className="justify-self-start sm:justify-self-end">
								{addValueControl}
							</div>
						) : null}
					</div>
				);
			})}
		</div>
	);
}
