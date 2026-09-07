import { type JSX, useState } from 'react';
import {
	FormComponentAutoComplete,
	FormComponentCheckbox,
	FormComponentInput,
	FormComponentSelect,
} from '@/components/form/form-element.component';
import { Icons } from '@/components/icon.component';
import { Button } from '@/components/ui/button';
import { Configuration } from '@/config/settings.config';
import { getLanguageClient } from '@/config/translate.setup';
import {
	ownErrorMessages,
	rowErrorsAt,
	toOptionsFromEnum,
} from '@/helpers/form.helper';
import { requestFind } from '@/helpers/services.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useRemoteAutocomplete } from '@/hooks/use-remote-autocomplete';
import type {
	ProductOptionGroupType,
	ProductOptionPriceType,
	ProductOptionType,
} from '@/models/product.model';
import {
	displayTermValue,
	type TermModel,
	TermTypeEnum,
} from '@/models/term.model';
import { CurrencyEnum } from '@/types/common.type';

/**
 * One delta as the form holds it. `price_delta` stays nullable while the field is empty — the
 * validator is what refuses a row that never got a figure, and typing a number should not have
 * to pass through `0` on the way.
 */
export type ProductOptionPriceFormType = ProductOptionPriceType;

/**
 * An answer as the form holds it.
 *
 * `key` is client-only: an answer has no identity of its own until it is saved (`label_id` is
 * null while the picker is still empty, and two half-filled rows would collide on it), and the
 * array index is exactly what a reorder changes — keying by it leaves the moved rows' inputs
 * holding their old neighbor's state. `label` is the wording the picker shows; the id is what
 * the payload carries. Both are stripped before the payload is built.
 */
export type ProductOptionFormType = Omit<
	ProductOptionType,
	'label_id' | 'position' | 'label'
> & {
	key: string;
	label_id: number | null;
	label: string;
	position: number;
	prices: ProductOptionPriceFormType[];
};

/** A group as the form holds it — same client-only fields, one level up. */
export type ProductOptionGroupFormType = Omit<
	ProductOptionGroupType,
	'label_id' | 'position' | 'options' | 'label'
> & {
	key: string;
	label_id: number | null;
	label: string;
	position: number;
	options: ProductOptionFormType[];
};

/*
 * Not `crypto.randomUUID()`: that needs a secure context, and the dev host is plain http, so it
 * would throw where it is most convenient to test. Uniqueness only has to hold within one form.
 */
let optionKeySequence = 0;

export function nextOptionKey(prefix: 'group' | 'option'): string {
	optionKeySequence += 1;

	return `${prefix}-${optionKeySequence}`;
}

/**
 * The market a new delta is quoted in. Deltas are per currency, so the first row has to name one,
 * and the books' own currency is the only defensible guess.
 */
const BASE_CURRENCY = Configuration.get('app.currency');

/**
 * A closed list rather than a free-text code: the column is `char(3)` and `(option_id, currency)`
 * is unique, so a typo does not fail — it silently prices a market nothing sells in.
 */
const CURRENCY_OPTIONS = toOptionsFromEnum(CurrencyEnum);

/**
 * Column widths shared by the delta table's header and its row cells.
 *
 * The rows are flex rather than a real `<table>` because each field is a `FormElement` carrying
 * its own error slot, and nothing aligns the two unless both sides name the same width. That
 * error slot is also why the width sits on the cell wrapper with `shrink-0`: a field's wrapper
 * grows to fit the message under it, and a wide one would otherwise push the remove button out
 * of line.
 */
const DELTA_COLUMN = {
	currency: 'w-28 shrink-0',
	amount: 'w-32 shrink-0',
} as const;

/** The wording an option's label term shows, in the editor's language. */
function displayLabelTerm(entry: TermModel): string {
	return displayTermValue(entry, getLanguageClient());
}

export function emptyOptionDelta(): ProductOptionPriceFormType {
	return {
		currency: BASE_CURRENCY,
		price_delta: null,
	};
}

export function emptyOption(position: number): ProductOptionFormType {
	return {
		key: nextOptionKey('option'),
		label_id: null,
		label: '',
		position,
		/*
		 * Nothing is preselected until someone says so. The backend allows a group with no
		 * default (the unique index is partial, on `is_default = true`), and preselecting an
		 * answer decides for the customer — a paid extra ticked by the editor's convention
		 * rather than their intent.
		 */
		is_default: false,
		prices: [emptyOptionDelta()],
	};
}

export function emptyOptionGroup(position: number): ProductOptionGroupFormType {
	return {
		key: nextOptionKey('group'),
		label_id: null,
		label: '',
		/*
		 * Optional and unbounded — the mildest shape a question can have, so adding a group
		 * never silently makes a product unorderable, nor caps a list before anyone has said
		 * how many answers it takes. Empty is what `max_select` reads as "no limit".
		 */
		min_select: 0,
		max_select: null,
		position,
		options: [emptyOption(0)],
	};
}

/**
 * The cardinality in words, because `min_select` / `max_select` are the *only* expression of it
 * — there is no `is_required` flag to read instead, and two bare numbers do not tell an operator
 * whether they have just made a question mandatory.
 */
function describeCardinality(
	minSelect: number | null,
	maxSelect: number | null,
): string {
	const min = minSelect ?? 0;

	if (maxSelect === null) {
		return min === 0
			? 'Optional — any number of answers.'
			: `Required — at least ${min}, no upper limit.`;
	}

	if (maxSelect === 1) {
		return min === 0
			? 'Optional — at most one answer.'
			: 'Required — exactly one answer.';
	}

	if (min === maxSelect) {
		return `Required — exactly ${min} answers.`;
	}

	return min === 0
		? `Optional — up to ${maxSelect} answers.`
		: `Required — between ${min} and ${maxSelect} answers.`;
}

/** `null` is a real choice for `max_select` — no upper bound — so it needs a value of its own. */
const NO_UPPER_BOUND = '';

function parseBound(value: string): number | null {
	return value === '' ? null : Number(value);
}

type DeltaRowProps = {
	price: ProductOptionPriceFormType;
	index: number;
	disabled: boolean;
	errors: unknown;
	canRemove: boolean;
	onChange: (patch: Partial<ProductOptionPriceFormType>) => void;
	onRemove: () => void;
};

function DeltaRow({
	price,
	index,
	disabled,
	errors,
	canRemove,
	onChange,
	onRemove,
}: DeltaRowProps): JSX.Element {
	const elementIds = useElementIds(['currency', 'delta'] as const);

	const rowErrors = rowErrorsAt<ProductOptionPriceFormType>(errors, index);

	return (
		<div className="flex flex-nowrap items-start gap-2">
			{/* The width is on the cell, not the control — see DELTA_COLUMN. */}
			<div className={DELTA_COLUMN.currency}>
				<FormComponentSelect<ProductOptionPriceFormType>
					id={elementIds.currency}
					fieldName="currency"
					fieldValue={price.currency}
					isRequired={true}
					ariaLabel="Currency"
					className="w-full"
					options={CURRENCY_OPTIONS}
					disabled={disabled}
					onChange={(value) => onChange({ currency: value })}
					error={ownErrorMessages(rowErrors?.currency)}
				/>
			</div>

			<div className={DELTA_COLUMN.amount}>
				<FormComponentInput<ProductOptionPriceFormType>
					id={elementIds.delta}
					fieldType="number"
					fieldName="price_delta"
					fieldValue={price.price_delta ?? ''}
					isRequired={true}
					ariaLabel="Price delta"
					className="w-full"
					disabled={disabled}
					onChange={(event) =>
						onChange({
							price_delta:
								event.target.value === ''
									? null
									: Number(event.target.value),
						})
					}
					error={ownErrorMessages(rowErrors?.price_delta)}
				/>
			</div>

			{canRemove ? (
				<Button
					type="button"
					variant="ghost"
					hover="error"
					disabled={disabled}
					onClick={onRemove}
					className="mt-1 p-2 opacity-60 hover:opacity-100"
					aria-label={`Remove currency ${index + 1}`}
					title="Remove currency"
				>
					<Icons.Close className="h-4 w-4" />
				</Button>
			) : null}
		</div>
	);
}

type OptionRowProps = {
	option: ProductOptionFormType;
	index: number;
	disabled: boolean;
	errors: unknown;
	isLast: boolean;
	canCreateTerm: boolean;
	onUpdate: (patch: Partial<ProductOptionFormType>) => void;
	onToggleDefault: () => void;
	onRemove: () => void;
	/** `-1` / `+1`; the buttons are disabled at the ends, so there is no range to check. */
	onMove: (offset: number) => void;
	onCreateTerm: (
		typedValue: string,
		apply: (entry: TermModel) => void,
	) => void;
};

function OptionRow({
	option,
	index,
	disabled,
	errors,
	isLast,
	canCreateTerm,
	onUpdate,
	onToggleDefault,
	onRemove,
	onMove,
	onCreateTerm,
}: OptionRowProps): JSX.Element {
	const elementIds = useElementIds(['label', 'default'] as const);

	const [search, setSearch] = useState('');

	const rowErrors = rowErrorsAt<ProductOptionFormType>(errors, index);

	const { suggestions, isFetching } = useRemoteAutocomplete<TermModel>({
		query: search,
		queryKey: ['s-product-option-label'],
		queryFn: async (term) => {
			const response = await requestFind<TermModel>('term', {
				filter: {
					term,
					/*
					 * `label_id` is a plain foreign key to `term`, so the backend accepts any
					 * row — unfiltered the picker offers the tags and the attribute vocabulary
					 * too, and an answer ends up wearing a category attribute's wording. `text`
					 * is what an answer is: free wording with nothing declaring it elsewhere.
					 */
					type: TermTypeEnum.TEXT,
				},
				limit: 10,
			});

			return response?.entries ?? [];
		},
	});

	const applyTerm = (entry: TermModel) => {
		onUpdate({ label_id: entry.id, label: displayLabelTerm(entry) });
		setSearch('');
	};

	const deltas = option.prices ?? [];

	return (
		<li className="rounded-md border border-line p-3 space-y-3">
			{/*
			 * The row's own controls above its fields rather than beside them, the way a variant
			 * row carries them: the picker renders a label of its own, and anything aligned
			 * against it has to guess the height of that label plus its error slot.
			 */}
			<div className="flex items-center justify-between gap-3">
				{/*
				 * Preselected is a property of the set, not of a row: ticking one answer unticks
				 * the rest, which is the group's unique partial index (`is_default = true`) held
				 * to on this side. Unticking is allowed and leaves the group with nothing
				 * preselected — the state a group starts in, and a legitimate one to return to.
				 */}
				<FormComponentCheckbox<ProductOptionFormType>
					id={elementIds.default}
					fieldName="is_default"
					checked={option.is_default}
					disabled={disabled}
					onCheckedChange={onToggleDefault}
				>
					Preselected
				</FormComponentCheckbox>

				<div className="flex items-center">
					<Button
						type="button"
						variant="ghost"
						hover="info"
						disabled={disabled || index === 0}
						onClick={() => onMove(-1)}
						className="p-2 disabled:opacity-30"
						aria-label={`Move answer ${index + 1} up`}
						title="Move answer up"
					>
						<Icons.Direction.ArrowUp className="h-4 w-4" />
					</Button>

					<Button
						type="button"
						variant="ghost"
						hover="info"
						disabled={disabled || isLast}
						onClick={() => onMove(1)}
						className="p-2 disabled:opacity-30"
						aria-label={`Move answer ${index + 1} down`}
						title="Move answer down"
					>
						<Icons.Direction.ArrowDown className="h-4 w-4" />
					</Button>

					<Button
						type="button"
						variant="ghost"
						hover="error"
						disabled={disabled}
						onClick={onRemove}
						className="p-2 disabled:opacity-30"
						aria-label={`Remove answer ${index + 1}`}
						title="Remove answer"
					>
						<Icons.Action.Delete className="h-4 w-4" />
					</Button>
				</div>
			</div>

			<div className="max-w-md">
				<FormComponentAutoComplete<ProductOptionFormType, TermModel>
					labelText="Answer"
					id={elementIds.label}
					fieldName="label"
					fieldValue={option.label}
					isRequired={true}
					placeholderText="eg: Extra bacon"
					className="w-full pl-8"
					disabled={disabled}
					// The id is what the row stores; the text is only how it was found, so an
					// answer typed but never picked reports against this field.
					error={ownErrorMessages(rowErrors?.label_id)}
					onInputChange={(value) => {
						onUpdate({ label: value, label_id: null });
						setSearch(value);
					}}
					autoCompleteProps={{
						suggestions,
						isLoading: isFetching,
						onSelect: applyTerm,
						getOptionLabel: displayLabelTerm,
						getOptionKey: (entry) => entry.id,
						allowCreate: canCreateTerm,
						onCreate: (value) => onCreateTerm(value, applyTerm),
						createLabel: (value) => `Create answer "${value}"`,
					}}
					icons={{
						left: <Icons.Tag className="opacity-40 h-4.5 w-4.5" />,
					}}
				/>
			</div>

			<div className="space-y-2 pl-1">
				<div className="flex flex-nowrap gap-2 text-xs font-semibold text-muted">
					<span className={DELTA_COLUMN.currency}>
						Currency
						<span className="ml-1 text-danger">*</span>
					</span>
					<span className={DELTA_COLUMN.amount}>
						Price delta
						<span className="ml-1 text-danger">*</span>
					</span>
				</div>

				{deltas.map((price, priceIndex) => (
					<DeltaRow
						// biome-ignore lint/suspicious/noArrayIndexKey: a delta row has no stable id — its currency is empty until the editor picks one
						key={`${option.key}-delta-${priceIndex}`}
						price={price}
						index={priceIndex}
						disabled={disabled}
						errors={rowErrors?.prices}
						/*
						 * The last row stays. An answer with no delta at all is accepted by
						 * the API and means "no price effect anywhere", but a zero in the
						 * base currency says the same thing where it can be read.
						 */
						canRemove={deltas.length > 1}
						onChange={(patch) =>
							onUpdate({
								prices: deltas.map((entry, current) =>
									current === priceIndex
										? { ...entry, ...patch }
										: entry,
								),
							})
						}
						onRemove={() =>
							onUpdate({
								prices: deltas.filter(
									(_, current) => current !== priceIndex,
								),
							})
						}
					/>
				))}

				{ownErrorMessages(rowErrors?.prices)?.map((message) => (
					<p key={message} className="text-sm text-danger">
						{message}
					</p>
				))}

				<div className="flex">
					<Button
						type="button"
						variant="ghost"
						hover="success"
						disabled={disabled}
						onClick={() =>
							onUpdate({
								prices: [...deltas, emptyOptionDelta()],
							})
						}
						className="p-2 text-xs opacity-80 hover:opacity-100"
						title="Add currency"
					>
						<Icons.Action.Add className="h-4 w-4" /> Add currency
					</Button>
				</div>
			</div>
		</li>
	);
}

type GroupCardProps = {
	group: ProductOptionGroupFormType;
	index: number;
	disabled: boolean;
	errors: unknown;
	isLast: boolean;
	canCreateTerm: boolean;
	onUpdate: (patch: Partial<ProductOptionGroupFormType>) => void;
	onRemove: () => void;
	onMove: (offset: number) => void;
	onCreateTerm: (
		typedValue: string,
		apply: (entry: TermModel) => void,
	) => void;
};

function OptionGroupCard({
	group,
	index,
	disabled,
	errors,
	isLast,
	canCreateTerm,
	onUpdate,
	onRemove,
	onMove,
	onCreateTerm,
}: GroupCardProps): JSX.Element {
	const elementIds = useElementIds([
		'label',
		'minSelect',
		'maxSelect',
	] as const);

	const [search, setSearch] = useState('');

	const groupErrors = rowErrorsAt<ProductOptionGroupFormType>(errors, index);

	const { suggestions, isFetching } = useRemoteAutocomplete<TermModel>({
		query: search,
		queryKey: ['s-product-option-label'],
		queryFn: async (term) => {
			const response = await requestFind<TermModel>('term', {
				filter: { term, type: TermTypeEnum.TEXT },
				limit: 10,
			});

			return response?.entries ?? [];
		},
	});

	const applyTerm = (entry: TermModel) => {
		onUpdate({ label_id: entry.id, label: displayLabelTerm(entry) });
		setSearch('');
	};

	const options = group.options ?? [];

	/**
	 * `position` is the order of the list rather than a field: it is re-stamped from the index
	 * after anything that moves a row, so what the editor sees and what the backend stores agree.
	 */
	const commitOptions = (next: ProductOptionFormType[]) => {
		onUpdate({
			options: next.map((option, position) => ({ ...option, position })),
		});
	};

	const updateOption = (
		optionIndex: number,
		patch: Partial<ProductOptionFormType>,
	) => {
		onUpdate({
			options: options.map((option, current) =>
				current === optionIndex ? { ...option, ...patch } : option,
			),
		});
	};

	/** Preselected belongs to the group, not to a row — marking one unmarks the rest. */
	/**
	 * At most one answer carries the flag, so ticking a row clears the others. Ticking the row
	 * that already holds it clears the group instead — a question whose answer the customer
	 * should choose for themselves is why the flag is optional.
	 */
	const toggleDefault = (optionIndex: number) => {
		const isDefault = options[optionIndex].is_default;

		onUpdate({
			options: options.map((option, current) => ({
				...option,
				is_default: !isDefault && current === optionIndex,
			})),
		});
	};

	/**
	 * Removing the preselected answer leaves the group with none. Nothing is promoted in its
	 * place: which answer is preselected is the editor's decision, and a group carrying none is
	 * what a new one starts as.
	 */
	const removeOption = (optionIndex: number) => {
		commitOptions(options.filter((_, current) => current !== optionIndex));
	};

	/** Swaps with the neighbour and re-stamps `position` through `commitOptions`. */
	const moveOption = (optionIndex: number, offset: number) => {
		const target = optionIndex + offset;
		const reordered = [...options];

		[reordered[optionIndex], reordered[target]] = [
			reordered[target],
			reordered[optionIndex],
		];

		commitOptions(reordered);
	};

	return (
		<li>
			<fieldset className="rounded-md border border-line p-3 space-y-4">
				{/*
				 * The question and the controls that act on it, on one line. `items-end` rather
				 * than `items-center`: the picker renders its own label above the input, so
				 * centring would align the buttons against that label instead of the field.
				 * Its error arrives as an absolutely positioned tooltip, which adds no height,
				 * so the row does not shift when the question fails validation.
				 */}
				<div className="flex items-end justify-between gap-3">
					<div className="w-full max-w-md">
						<FormComponentAutoComplete<
							ProductOptionGroupFormType,
							TermModel
						>
							labelText="Question"
							id={elementIds.label}
							fieldName="label"
							fieldValue={group.label}
							isRequired={true}
							placeholderText="eg: Choose a side"
							className="w-full pl-8"
							disabled={disabled}
							error={ownErrorMessages(groupErrors?.label_id)}
							onInputChange={(value) => {
								onUpdate({ label: value, label_id: null });
								setSearch(value);
							}}
							autoCompleteProps={{
								suggestions,
								isLoading: isFetching,
								onSelect: applyTerm,
								getOptionLabel: displayLabelTerm,
								getOptionKey: (entry) => entry.id,
								allowCreate: canCreateTerm,
								onCreate: (value) =>
									onCreateTerm(value, applyTerm),
								createLabel: (value) =>
									`Create question "${value}"`,
							}}
							icons={{
								left: (
									<Icons.Tag className="opacity-40 h-4.5 w-4.5" />
								),
							}}
						/>
					</div>

					<div className="flex items-center">
						<Button
							type="button"
							variant="ghost"
							hover="info"
							disabled={disabled || index === 0}
							onClick={() => onMove(-1)}
							className="p-2 disabled:opacity-30"
							aria-label={`Move question ${index + 1} up`}
							title="Move question up"
						>
							<Icons.Direction.ArrowUp className="h-4 w-4" />
						</Button>

						<Button
							type="button"
							variant="ghost"
							hover="info"
							disabled={disabled || isLast}
							onClick={() => onMove(1)}
							className="p-2 disabled:opacity-30"
							aria-label={`Move question ${index + 1} down`}
							title="Move question down"
						>
							<Icons.Direction.ArrowDown className="h-4 w-4" />
						</Button>

						<Button
							type="button"
							variant="ghost"
							hover="error"
							disabled={disabled}
							onClick={onRemove}
							className="p-2 disabled:opacity-30"
							aria-label={`Remove question ${index + 1}`}
							title="Remove question"
						>
							<Icons.Action.Delete className="h-4 w-4" />
						</Button>
					</div>
				</div>

				<div className="space-y-1">
					<div className="flex flex-wrap gap-2">
						<FormComponentInput<ProductOptionGroupFormType>
							labelText="Minimum answers"
							id={elementIds.minSelect}
							fieldType="number"
							fieldName="min_select"
							fieldValue={group.min_select ?? ''}
							className="w-32"
							disabled={disabled}
							onChange={(event) =>
								onUpdate({
									min_select: parseBound(event.target.value),
								})
							}
							error={ownErrorMessages(groupErrors?.min_select)}
						/>

						<FormComponentInput<ProductOptionGroupFormType>
							labelText="Maximum answers"
							id={elementIds.maxSelect}
							fieldType="number"
							fieldName="max_select"
							fieldValue={group.max_select ?? NO_UPPER_BOUND}
							placeholderText="no limit"
							className="w-32"
							disabled={disabled}
							onChange={(event) =>
								onUpdate({
									max_select: parseBound(event.target.value),
								})
							}
							error={ownErrorMessages(groupErrors?.max_select)}
						/>
					</div>

					{/*
					 * The two numbers restated in words. They are the whole expression of
					 * cardinality — there is no `is_required` flag — so what the pair means is
					 * worth saying rather than leaving to be inferred.
					 */}
					<p className="flex items-center gap-1 text-xs text-muted">
						<Icons.Info className="h-3.5 w-3.5 shrink-0" />

						<span>
							{describeCardinality(
								group.min_select,
								group.max_select,
							)}{' '}
							Leave the maximum empty for no upper limit.
						</span>
					</p>
				</div>

				<div className="space-y-2">
					<h3 className="text-sm font-semibold border-b border-line pb-2">
						Answers
					</h3>

					<p className="text-xs text-muted">
						Each answer moves the variant price by its delta, per
						market. A negative delta is legitimate — declining
						something the price already includes.
					</p>

					{options.length === 0 ? (
						<p className="text-sm text-muted">
							A question has to offer something — add at least one
							answer.
						</p>
					) : (
						<ul className="space-y-2">
							{options.map((option, optionIndex) => (
								<OptionRow
									key={option.key}
									option={option}
									index={optionIndex}
									disabled={disabled}
									errors={groupErrors?.options}
									isLast={optionIndex === options.length - 1}
									canCreateTerm={canCreateTerm}
									onUpdate={(patch) =>
										updateOption(optionIndex, patch)
									}
									onToggleDefault={() =>
										toggleDefault(optionIndex)
									}
									onRemove={() => removeOption(optionIndex)}
									onMove={(offset) =>
										moveOption(optionIndex, offset)
									}
									onCreateTerm={onCreateTerm}
								/>
							))}
						</ul>
					)}

					{ownErrorMessages(groupErrors?.options)?.map((message) => (
						<p key={message} className="text-sm text-danger">
							{message}
						</p>
					))}

					<div className="flex">
						<Button
							type="button"
							variant="ghost"
							hover="success"
							disabled={disabled}
							onClick={() =>
								commitOptions([
									...options,
									emptyOption(options.length),
								])
							}
							className="p-2 opacity-80 hover:opacity-100"
						>
							<Icons.Action.Add className="h-4 w-4" /> Add answer
						</Button>
					</div>
				</div>
			</fieldset>
		</li>
	);
}

type Props = {
	value: ProductOptionGroupFormType[];
	onChange: (value: ProductOptionGroupFormType[]) => void;
	disabled: boolean;
	errors: unknown;
	/** Whether the account may create the `term` an unlisted question or answer needs. */
	canCreateTerm: boolean;
	/**
	 * Opens the `term` window seeded with the typed wording, and applies the saved row to
	 * whichever picker asked. Held by the host rather than here because it has to focus the
	 * parent window again, which only the form that owns it can name.
	 */
	onCreateTerm: (
		typedValue: string,
		apply: (entry: TermModel) => void,
	) => void;
};

/**
 * The questions a product asks at order time, and what each answer does to the price.
 *
 * **An empty list is the meaningful default** — most products ask nothing — which is why no group
 * is seeded and the empty state says so rather than reading as something unfinished. The opposite
 * default from the variants editor, where at least one row is required.
 *
 * A group is a question, its answers are the rows inside it, and each answer carries one signed
 * delta per market. What a group accepts is `min_select` / `max_select` and nothing else: there
 * is no required flag, because a flag and a bound have to agree forever and that is the pair
 * nobody notices drifting.
 *
 * Both levels are labelled by a `term`, so a product asks the same question in every language it
 * is translated into without the wording being repeated per product.
 */
export function FormOptionsProduct({
	value,
	onChange,
	disabled,
	errors,
	canCreateTerm,
	onCreateTerm,
}: Props): JSX.Element {
	/** Re-stamps `position` from the index — see the same function one level down. */
	const commit = (groups: ProductOptionGroupFormType[]) => {
		onChange(groups.map((group, position) => ({ ...group, position })));
	};

	const updateGroup = (
		index: number,
		patch: Partial<ProductOptionGroupFormType>,
	) => {
		onChange(
			value.map((group, current) =>
				current === index ? { ...group, ...patch } : group,
			),
		);
	};

	const moveGroup = (index: number, offset: number) => {
		const target = index + offset;
		const reordered = [...value];

		[reordered[index], reordered[target]] = [
			reordered[target],
			reordered[index],
		];

		commit(reordered);
	};

	return (
		<div className="space-y-3">
			{/* Listed rather than joined: independent rules read as one garbled message when
			    run into a single sentence. */}
			{ownErrorMessages(errors)?.map((message) => (
				<p key={message} className="text-sm text-danger">
					{message}
				</p>
			))}

			{value.length === 0 ? (
				<p className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-muted">
					No questions — the product is ordered as it is, with nothing
					for the customer to choose.
				</p>
			) : (
				<ul className="space-y-3">
					{value.map((group, index) => (
						<OptionGroupCard
							key={group.key}
							group={group}
							index={index}
							disabled={disabled}
							errors={errors}
							isLast={index === value.length - 1}
							canCreateTerm={canCreateTerm}
							onUpdate={(patch) => updateGroup(index, patch)}
							onRemove={() =>
								commit(
									value.filter(
										(_, current) => current !== index,
									),
								)
							}
							onMove={(offset) => moveGroup(index, offset)}
							onCreateTerm={onCreateTerm}
						/>
					))}
				</ul>
			)}

			<div className="flex">
				<Button
					type="button"
					variant="ghost"
					hover="success"
					disabled={disabled}
					onClick={() =>
						commit([...value, emptyOptionGroup(value.length)])
					}
					className="p-2 opacity-80 hover:opacity-100"
				>
					<Icons.Action.Add className="h-4 w-4" /> Add question
				</Button>
			</div>

			{/*
			 * The whole set as one field. `processForm` rebuilds its values from `FormData`, and
			 * two levels of nesting make per-input names unworkable — the same approach the
			 * variants editor takes.
			 */}
			<input
				type="hidden"
				name="option_groups"
				value={JSON.stringify(value)}
			/>
		</div>
	);
}
