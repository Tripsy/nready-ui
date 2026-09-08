import { Label } from '@heroui/react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
	componentDeltaFor,
	emptyComponent,
	emptyGroup,
	isComponentChosen,
	type ProductBundleComponentFormType,
	type ProductBundleGroupFormType,
	withComponentDelta,
} from '@/app/(dashboard)/dashboard/product/product-bundle.definition';
import {
	FormComponentAutoComplete,
	FormComponentCheckbox,
	FormComponentInput,
	FormComponentSelect,
} from '@/components/form/form-element.component';
import { Icons } from '@/components/icon.component';
import { Button } from '@/components/ui/button';
import { getLanguageClient } from '@/config/translate.setup';
import { ownErrorMessages, rowErrorsAt } from '@/helpers/form.helper';
import { requestFind } from '@/helpers/services.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useRemoteAutocomplete } from '@/hooks/use-remote-autocomplete';
import {
	displayProductVariantLabel,
	type ProductVariantModel,
} from '@/models/product-variant.model';
import {
	displayTermValue,
	type TermModel,
	TermTypeEnum,
} from '@/models/term.model';
import {
	findBundleCandidates,
	findVariantsByIds,
} from '@/services/product.service';

/**
 * A base component the bundle simply contains, rather than one a choice picks.
 *
 * The control is on the **base** list, not the optional one, because a choice is not optional: it
 * takes exactly one of its candidates every time, so the bundle always contains one of them. What
 * varies is which - the fries in a burger menu are always there, and the choice only decides their
 * size.
 *
 * Cannot collide with a choice's own value: those are the client-only keys `nextGroupKey` hands
 * out, which are always `group-<n>`.
 */
const OUTRIGHT = 'outright';

/** The wording a group's label term shows, in the editor's language. */
function displayGroupTerm(entry: TermModel): string {
	return displayTermValue(entry, getLanguageClient());
}

/** What a group is called in the pickers, before its label term has been chosen. */
function groupName(group: ProductBundleGroupFormType, index: number): string {
	return group.label.trim() || `Choice ${index + 1}`;
}

/**
 * One choice: its prompt, and nothing else. Exactly one of its candidates is taken.
 *
 * Drawn as a bare row rather than a card, because there is only one field in it - a card's border
 * plus a field label would be two frames around a single input. The candidates are not listed here
 * either. They are the component rows below, each naming this choice in its own picker, which
 * keeps a component described in exactly one place whether it belongs to a choice or not - the
 * same reason the API carries the two lists flat and side by side.
 */
function GroupRow({
	group,
	index,
	pending,
	errors,
	candidates,
	canCreateTerm,
	onChange,
	onRemove,
	onCreateTerm,
}: {
	group: ProductBundleGroupFormType;
	index: number;
	pending: boolean;
	errors: unknown;
	/** How many components name this choice; two is the fewest that makes it a choice. */
	candidates: number;
	canCreateTerm: boolean;
	onChange: (value: ProductBundleGroupFormType) => void;
	onRemove: () => void;
	onCreateTerm: (
		typedValue: string,
		apply: (entry: TermModel) => void,
	) => void;
}) {
	const [search, setSearch] = useState('');

	const elementIds = useElementIds([`group-label-${group.key}`] as const);

	const groupErrors = rowErrorsAt<ProductBundleGroupFormType>(errors, index);

	const { suggestions, isFetching } = useRemoteAutocomplete<TermModel>({
		query: search,
		queryKey: ['s-bundle-group-label'],
		queryFn: async (term) => {
			const response = await requestFind<TermModel>('term', {
				/*
				 * `label_id` is a plain foreign key to `term`, so the backend accepts any type
				 * behind it - the narrowing is entirely this filter's doing. `bundle_choice`
				 * exists so the list stays the prompts an operator actually wrote for bundles,
				 * rather than every `text` term in the catalog.
				 */
				filter: { term, type: TermTypeEnum.BUNDLE_CHOICE },
				limit: 10,
			});

			return response?.entries ?? [];
		},
	});

	const applyTerm = (entry: TermModel) => {
		onChange({
			...group,
			label_id: entry.id,
			label: displayGroupTerm(entry),
		});
		setSearch('');
	};

	return (
		<div>
			{/*
			 * Stretched rather than aligned to a height of its own: the field is `text-base` and
			 * drops to `md:text-sm`, so it is 42px on a narrow window and 38px above `md`, and a
			 * button pinned to either number is wrong at the other. With no label above the input
			 * the two now share one box, and the button follows it.
			 */}
			<div className="flex gap-2">
				<div className="min-w-0 grow">
					<FormComponentAutoComplete<
						ProductBundleGroupFormType,
						TermModel
					>
						ariaLabel="Choice prompt"
						id={elementIds[`group-label-${group.key}`]}
						fieldName="label"
						fieldValue={group.label}
						isRequired={true}
						placeholderText="eg: Choose your fries"
						className="w-full pl-8"
						disabled={pending}
						/*
						 * The id is what the row stores; the text is only how it was found, so a
						 * prompt typed but never picked reports against this field.
						 */
						error={ownErrorMessages(groupErrors?.label_id)}
						onInputChange={(value) => {
							onChange({
								...group,
								label: value,
								label_id: null,
							});
							setSearch(value);
						}}
						autoCompleteProps={{
							suggestions,
							isLoading: isFetching,
							onSelect: applyTerm,
							getOptionLabel: displayGroupTerm,
							getOptionKey: (entry) => entry.id,
							allowCreate: canCreateTerm,
							onCreate: (value) => onCreateTerm(value, applyTerm),
							createLabel: (value) => `Create prompt "${value}"`,
						}}
						icons={{
							left: (
								<Icons.Tag className="opacity-40 h-4.5 w-4.5" />
							),
						}}
					/>
				</div>

				{/*
				 * `h-auto` undoes the `h-fit` the button variant carries, which is what would
				 * otherwise keep it at its icon's height and ignore the stretch.
				 */}
				<Button
					type="button"
					variant="outline"
					hover="error"
					disabled={pending}
					onClick={onRemove}
					className="h-auto self-stretch"
					aria-label={`Remove ${groupName(group, index)}`}
				>
					<Icons.Action.Delete className="h-4 w-4" />
				</Button>
			</div>

			{/*
			 * How many components name this choice, which is the one thing about it that lives
			 * outside this row. What a choice *means* is said once in the panel above rather than
			 * repeated under every prompt.
			 */}
			<p className="mt-1 text-xs text-muted">
				{candidates === 1
					? '1 candidate - a choice needs two'
					: `${candidates} candidates`}
			</p>

			{/*
			 * Too few candidates is reported on the choice itself rather than on a field, since it
			 * belongs to none. `rowErrorsAt` returns it under the entry.
			 */}
			{ownErrorMessages(groupErrors)?.length ? (
				<p className="mt-1 text-xs text-danger">
					{ownErrorMessages(groupErrors)?.join(' ')}
				</p>
			) : null}
		</div>
	);
}

/**
 * What the component costs on its own in one market, as the row shows it.
 *
 * Returns null when the variant has no price there: a bundle priced in a currency one of its
 * components is not is a real state, and the row says so rather than rendering a bare delta as if
 * it were the whole figure.
 */
function standalonePrice(
	resolved: ProductVariantModel | undefined,
	currency: string,
): number | null {
	return (
		resolved?.prices?.find((price) => price.currency === currency)
			?.sale_price ?? null
	);
}

/**
 * One market's adjustment to a component's price, with the arithmetic spelled out beside it.
 *
 * The sum is what the editor is actually deciding - "-150" means nothing without the 1200 it comes
 * off - and it is not stored anywhere: the bundle keeps the delta, and the component's own price
 * moves with the component.
 */
function DeltaField({
	component,
	currency,
	pending,
	error,
	resolved,
	onChange,
}: {
	component: ProductBundleComponentFormType;
	currency: string;
	pending: boolean;
	error?: string[];
	resolved?: ProductVariantModel;
	onChange: (value: ProductBundleComponentFormType) => void;
}) {
	const elementIds = useElementIds([
		`component-delta-${component.key}-${currency}`,
	] as const);

	const delta = componentDeltaFor(component, currency);
	const base = standalonePrice(resolved, currency);
	const parsed = delta.trim() === '' ? 0 : Number(delta);

	const total =
		base === null || !Number.isFinite(parsed) ? null : base + parsed;

	const label = `Delta ${currency}`;

	/*
	 * One market per line - label, field, arithmetic - rather than the fields side by side: the
	 * sum beside each one is a sentence, and read across a row it was the neighbouring market's
	 * figures it sat next to.
	 */
	return (
		<div className="flex flex-wrap items-center gap-2">
			{/*
			 * The label sits beside the input, which is why it is rendered here rather than
			 * passed as `labelText`: `FormElement` always stacks the two.
			 */}
			<Label
				htmlFor={
					elementIds[`component-delta-${component.key}-${currency}`]
				}
				className="w-20 shrink-0 whitespace-nowrap"
			>
				{label}
			</Label>

			{/*
			 * Typed against the delta row rather than the component: `price_delta` is a field of
			 * one entry in `prices`, and the whole list is what the component carries.
			 */}
			<FormComponentInput<{ price_delta: string }>
				ariaLabel={label}
				fieldType="number"
				id={elementIds[`component-delta-${component.key}-${currency}`]}
				fieldName="price_delta"
				fieldValue={delta}
				className="max-w-32"
				disabled={pending}
				placeholderText="0.00"
				onChange={(event) =>
					onChange(
						withComponentDelta(
							component,
							currency,
							event.target.value,
						),
					)
				}
				error={error}
			/>

			{/*
			 * Named rather than left as a bare arrow: the two figures are the component's own
			 * price and what taking it adds, and which is which is exactly what the delta's
			 * meaning turns on.
			 */}
			<p className="text-xs text-muted">
				{base === null
					? `No ${currency} price`
					: `${base.toFixed(2)} on its own → adds ${total === null ? '-' : total.toFixed(2)}`}
			</p>
		</div>
	);
}

/**
 * One component of the bundle: what it points at, and how many.
 *
 * The variant it names is fixed once chosen - swapping one component for another is removing a
 * row and adding another, which is also what the API sees, since `syncItems` keys on
 * `variant_id`. So the row shows the SKU and name read-only rather than re-opening the picker.
 *
 * Whether the customer may decline the component is not a field here at all: it is which of the
 * two lists the row sits in, and the arrow moves it. That leaves the base list one question to
 * ask - contained outright, or through a choice - and the optional list none.
 */
function ComponentRow({
	component,
	index,
	section,
	pending,
	errors,
	currencies,
	groups,
	resolved,
	onChange,
	onRemove,
	onMove,
}: {
	component: ProductBundleComponentFormType;
	index: number;
	/** Which list the row is drawn in, which is the whole of what it means to be optional. */
	section: 'base' | 'optional';
	pending: boolean;
	errors: unknown;
	/** The markets the bundle itself is priced in - one delta field each. */
	currencies: string[];
	/** The choices this component may be a candidate for, or none. */
	groups: ProductBundleGroupFormType[];
	/** Looked up by the editor, which is the only place a component's own price is known. */
	resolved?: ProductVariantModel;
	onChange: (value: ProductBundleComponentFormType) => void;
	onRemove: () => void;
	onMove: () => void;
}) {
	const elementIds = useElementIds([
		`component-quantity-${component.key}`,
		`component-choice-${component.key}`,
		`component-default-${component.key}`,
	] as const);

	const rowErrors = rowErrorsAt<ProductBundleComponentFormType>(
		errors,
		index,
	);

	const isOptional = section === 'optional';

	/** Whether anything is left to the customer here - an optional row, or one inside a choice. */
	const isChosen = isComponentChosen(component);

	/*
	 * A ceiling only in the optional list, where the customer picks how many to take. A candidate
	 * is not a ceiling: its choice decides *which* candidate, never how many of it, so the figure
	 * is the count the bundle contains once that candidate is the one taken - the same as any
	 * other base component.
	 */
	const quantityLabel = isOptional ? 'Max quantity' : 'Quantity';

	return (
		<div className="rounded-lg border border-line p-3">
			{/*
			 * The name gets the full width of its own row: a SKU and a product label together run
			 * long, and sharing a line with the fields either truncated it or pushed them out of
			 * reach on a narrow window.
			 */}
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0">
					<div className="text-sm font-medium">
						{component.sku ||
							resolved?.sku ||
							`#${component.variant_id}`}
					</div>
					<div className="truncate text-xs text-muted">
						{component.label ||
							resolved?.product?.contents?.[0]?.label ||
							'-'}
					</div>
				</div>

				{/*
				 * Beside the name rather than after the fields: both act on the row as a whole
				 * rather than on any one value, and the field line is already the widest thing
				 * here - a base component and an optional one wrap differently, so buttons
				 * trailing it landed in a different place on each.
				 */}
				<div className="flex shrink-0 gap-2">
					{/*
					 * The two lists sit one above the other, so the arrow points at where the
					 * row is going. This is the only way between them: the alternative is
					 * deleting the row and adding it back, which throws away its deltas.
					 */}
					<Button
						type="button"
						variant="outline"
						disabled={pending}
						onClick={onMove}
						aria-label={
							isOptional
								? `Make ${component.sku} a base component`
								: `Make ${component.sku} optional`
						}
						title={isOptional ? 'Move to base' : 'Move to optional'}
					>
						{isOptional ? (
							<Icons.Direction.ArrowUp className="h-4 w-4" />
						) : (
							<Icons.Direction.ArrowDown className="h-4 w-4" />
						)}
					</Button>

					<Button
						type="button"
						variant="outline"
						hover="error"
						disabled={pending}
						onClick={onRemove}
						aria-label={`Remove ${component.sku}`}
					>
						<Icons.Action.Delete className="h-4 w-4" />
					</Button>
				</div>
			</div>

			{/*
			 * `items-center` rather than `items-end`: the fields on this row are different
			 * heights - a checkbox is shorter than an input - and aligning their baselines left
			 * the boxes and the delete button sitting low against the quantity field.
			 */}
			<div className="mt-2 flex flex-wrap items-center gap-3">
				{/*
				 * The label sits beside the input rather than above it, which is why it is
				 * rendered here instead of passed as `labelText`: `FormElement` always stacks
				 * the two. `htmlFor` still focuses the input on click, and `ariaLabel` below
				 * carries the same wording for anything that reads the field on its own.
				 */}
				<div className="flex items-center gap-2">
					<Label
						htmlFor={
							elementIds[`component-quantity-${component.key}`]
						}
						className="whitespace-nowrap"
					>
						{quantityLabel}
					</Label>

					<FormComponentInput<ProductBundleComponentFormType>
						ariaLabel={quantityLabel}
						id={elementIds[`component-quantity-${component.key}`]}
						fieldType="number"
						fieldName="quantity"
						fieldValue={component.quantity}
						className="max-w-24"
						disabled={pending}
						onChange={(event) =>
							onChange({
								...component,
								quantity: event.target.value,
							})
						}
						error={ownErrorMessages(rowErrors?.quantity)}
					/>
				</div>

				{!isOptional && (
					<FormComponentSelect<ProductBundleComponentFormType>
						ariaLabel="Included outright, or through a choice"
						id={elementIds[`component-choice-${component.key}`]}
						fieldName="group_key"
						fieldValue={component.group_key ?? OUTRIGHT}
						className="w-44"
						disabled={pending}
						options={[
							{ label: 'Included outright', value: OUTRIGHT },
							...groups.map((group, groupIndex) => ({
								label: groupName(group, groupIndex),
								value: group.key,
							})),
						]}
						/*
						 * Leaving a choice clears the preselect and the deltas: a component the
						 * bundle simply contains offers no decision, so there is nothing to
						 * preselect and its delta would have nothing to adjust - the API refuses
						 * both there.
						 */
						onChange={(next) =>
							onChange(
								next === OUTRIGHT
									? {
											...component,
											group_key: null,
											is_default: false,
											prices: [],
										}
									: { ...component, group_key: next },
							)
						}
						error={ownErrorMessages(rowErrors?.group_key)}
					/>
				)}

				{/*
				 * Only where there is something to preselect: a component the bundle always
				 * contains outright is taken whatever the customer does.
				 */}
				{isChosen && (
					<FormComponentCheckbox<ProductBundleComponentFormType>
						id={elementIds[`component-default-${component.key}`]}
						fieldName="is_default"
						checked={component.is_default}
						disabled={pending}
						onCheckedChange={(checked) =>
							onChange({ ...component, is_default: checked })
						}
						error={ownErrorMessages(rowErrors?.is_default)}
					>
						Preselected
					</FormComponentCheckbox>
				)}
			</div>

			{/*
			 * What a delta means is said once per section, above the list, rather than on every
			 * row that carries one - the sentence is the same for all of them, and repeated on
			 * each row it buried the fields it explains.
			 */}
			{isChosen && (
				<div className="mt-3 space-y-2 border-t border-line pt-3">
					{currencies.length === 0 ? (
						<p className="text-xs text-muted">
							Price the bundle first - a delta needs a market to
							be quoted in.
						</p>
					) : (
						currencies.map((currency) => (
							<DeltaField
								key={currency}
								component={component}
								currency={currency}
								pending={pending}
								resolved={resolved}
								error={ownErrorMessages(rowErrors?.prices)}
								onChange={onChange}
							/>
						))
					)}
				</div>
			)}
		</div>
	);
}

/**
 * One of the two component lists: its own picker, its own rows.
 *
 * The picker is per section rather than one above both, so adding lands the component where it
 * belongs in a single step. Its suggestions are filtered against every component the bundle
 * already holds, not just this list's - `syncItems` keys on `variant_id`, so the same variant in
 * both lists would silently collapse into one row.
 *
 * `entries` carry the index each row holds in the single underlying array, which is what the
 * callbacks address: the lists are a render-time partition, and `position` still comes from that
 * array's order on the way to the API.
 */
function ComponentSection({
	title,
	hint,
	deltaHint,
	emptyText,
	searchKey,
	pending,
	entries,
	chosen,
	errors,
	setError,
	currencies,
	groups,
	resolvedVariants,
	onAdd,
	onChangeAt,
	onRemoveAt,
	onMoveAt,
}: {
	title: string;
	hint: string;
	/** What the per-market adjustment on a row means, said once for the whole list. */
	deltaHint: string;
	emptyText: string;
	/** Keeps the two sections' suggestion caches apart; they query the same endpoint. */
	searchKey: 'base' | 'optional';
	pending: boolean;
	entries: { component: ProductBundleComponentFormType; index: number }[];
	/** Every variant the bundle holds, across both lists. */
	chosen: Set<number>;
	errors: unknown;
	/** The set-wide message, which only the base list can break. */
	setError?: string[];
	currencies: string[];
	groups: ProductBundleGroupFormType[];
	resolvedVariants?: Map<number, ProductVariantModel>;
	onAdd: (variant: ProductVariantModel) => void;
	onChangeAt: (index: number, value: ProductBundleComponentFormType) => void;
	onRemoveAt: (index: number) => void;
	onMoveAt: (index: number) => void;
}) {
	const [search, setSearch] = useState('');

	const elementIds = useElementIds([
		`component-search-${searchKey}`,
	] as const);

	const { suggestions, isFetching } =
		useRemoteAutocomplete<ProductVariantModel>({
			query: search,
			queryKey: [`s-bundle-component-${searchKey}`],
			queryFn: (term) => findBundleCandidates(term),
			minLength: 3,
		});

	return (
		<div className="space-y-2">
			<h3 className="text-sm font-medium">{title}</h3>

			<p className="text-xs text-muted">{hint}</p>

			<p className="text-xs text-muted">{deltaHint}</p>

			<FormComponentAutoComplete<
				{ component_search: string },
				ProductVariantModel
			>
				id={elementIds[`component-search-${searchKey}`]}
				ariaLabel={`Add a component to ${title.toLowerCase()}`}
				fieldName="component_search"
				fieldValue={search}
				className="pl-8"
				disabled={pending}
				icons={{
					left: <Icons.Search className="opacity-40 h-4.5 w-4.5" />,
				}}
				placeholderText="Search by SKU or product name…"
				onInputChange={setSearch}
				autoCompleteProps={{
					suggestions: suggestions.filter(
						(entry) => !chosen.has(entry.id),
					),
					isLoading: isFetching,
					onSelect: (entry) => {
						onAdd(entry);
						setSearch('');
					},
					getOptionLabel: (entry) =>
						displayProductVariantLabel(entry),
					getOptionKey: (entry) => entry.id,
				}}
			/>

			{setError && (
				<p className="text-xs text-danger">{setError.join(' ')}</p>
			)}

			{entries.length === 0 ? (
				<p className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-muted">
					{emptyText}
				</p>
			) : (
				entries.map(({ component, index }) => (
					<ComponentRow
						key={component.key}
						component={component}
						index={index}
						section={searchKey}
						pending={pending}
						errors={errors}
						currencies={currencies}
						groups={groups}
						resolved={resolvedVariants?.get(component.variant_id)}
						onChange={(next) => onChangeAt(index, next)}
						onRemove={() => onRemoveAt(index)}
						onMove={() => onMoveAt(index)}
					/>
				))
			)}
		</div>
	);
}

/**
 * The bundle's components, split into the two lists that say who decides on them, and the choices
 * some of the optional ones are candidates for.
 *
 * **Base components** the bundle always contains: outright, or as the candidate a choice picks -
 * a choice takes exactly one of its candidates every time, so it is not optional, and only *which*
 * one is left to the customer. **Optional components** the customer may decline outright, each
 * bounded by its own `quantity`.
 *
 * That is the difference between "add a dessert" and "choose your fries", and why only a choice
 * can say *exactly one of these*: two tick boxes can both be ticked or both left.
 *
 * Each unit of a component the customer decides on - either kind - adds its own price plus the
 * signed delta below it, per market, and its `quantity` is a ceiling rather than a count.
 *
 * The two-unit floor counts the components contained outright alone: neither something declinable
 * nor a candidate, whose identity is not known until the order, can be what makes a bundle a
 * bundle.
 */
export function FormComponentsBundle({
	value,
	groups,
	pending,
	errors,
	groupErrors,
	setError,
	groupsSetError,
	currencies,
	canCreateTerm,
	onChange,
	onGroupsChange,
	onCreateTerm,
}: {
	value: ProductBundleComponentFormType[];
	groups: ProductBundleGroupFormType[];
	pending: boolean;
	errors: unknown;
	groupErrors: unknown;
	setError?: string[];
	groupsSetError?: string[];
	/** The markets on the Price tab, which is where a delta's currency comes from. */
	currencies: string[];
	canCreateTerm: boolean;
	onChange: (value: ProductBundleComponentFormType[]) => void;
	onGroupsChange: (value: ProductBundleGroupFormType[]) => void;
	onCreateTerm: (
		typedValue: string,
		apply: (entry: TermModel) => void,
	) => void;
}) {
	/**
	 * Removing a choice releases its candidates rather than removing them: the components are
	 * still part of the bundle, they have simply stopped being alternatives. They stay in the base
	 * list and become contained outright - which is what the row's own picker does on `Included
	 * outright`, and it takes the preselect and the deltas with it for the same reason.
	 *
	 * That leaves every former candidate in the bundle at once. Removing a choice of two fries
	 * therefore puts *both* in it, which is worth noticing before saving - but it is the only
	 * reading that loses nothing, and deleting rows on the editor's behalf would.
	 */
	const removeGroup = (index: number) => {
		const removed = groups[index];

		onGroupsChange(groups.filter((_, current) => current !== index));

		onChange(
			value.map((component) =>
				component.group_key === removed.key
					? {
							...component,
							group_key: null,
							is_default: false,
							prices: [],
						}
					: component,
			),
		);
	};

	/**
	 * One row, and the preselect kept exclusive within its choice.
	 *
	 * A choice takes exactly one candidate, so preselecting one has to unmark the rest - the same
	 * rule `form-options-product` applies to an option group's answers, and the one the API holds
	 * with a partial unique index on `(group_id) WHERE is_default`. Enforced as the editor ticks
	 * rather than left to the validator: the form would otherwise sit with two candidates marked,
	 * which reads as a legal state right up until the save refuses it.
	 *
	 * Ungrouped tick boxes are outside the rule - they are not alternatives to each other, so any
	 * number of them may start ticked.
	 */
	const updateAt = (index: number, next: ProductBundleComponentFormType) => {
		const exclusive = next.is_default && next.group_key !== null;

		onChange(
			value.map((entry, entryIndex) => {
				if (entryIndex === index) {
					return next;
				}

				return exclusive && entry.group_key === next.group_key
					? { ...entry, is_default: false }
					: entry;
			}),
		);
	};

	/**
	 * The two lists are one array, partitioned on render - `position` comes from the array order
	 * on the way to the API, and a component belongs to exactly one list, so nothing is gained by
	 * holding two.
	 *
	 * The split is `is_optional` and nothing else, which is also the column behind it. A
	 * candidate is **not** optional: its choice takes exactly one of them every time, so the
	 * bundle always contains one - the fries in a burger menu are always there, and the choice
	 * only decides their size. Candidates therefore belong to the base list, alongside the
	 * components contained outright.
	 */
	const entries = value.map((component, index) => ({ component, index }));

	const baseEntries = entries.filter((entry) => !entry.component.is_optional);
	const optionalEntries = entries.filter(
		(entry) => entry.component.is_optional,
	);

	/**
	 * Across the two lists, in either direction.
	 *
	 * Going optional drops the choice - a candidate is decided by its choice, and a row claiming
	 * to be optional as well would be a second answer to that question - but keeps the preselect
	 * and the deltas, which mean the same thing on a tick box. Coming back keeps neither: without
	 * a choice the row is contained outright, and the API refuses both there.
	 */
	const moveAt = (index: number) => {
		const component = value[index];

		updateAt(
			index,
			component.is_optional
				? {
						...component,
						is_optional: false,
						group_key: null,
						is_default: false,
						prices: [],
					}
				: { ...component, is_optional: true, group_key: null },
		);
	};

	/*
	 * Every component's variant, not only the ones that arrived as a bare id: the row shows the
	 * component's own price beside its delta, and that price is on the variant rather than in the
	 * form's state. One request through the listing's `id` list filter, cached long enough that
	 * typing in the grid does not re-issue it.
	 */
	const componentIds = value
		.map((component) => component.variant_id)
		.sort((left, right) => left - right);

	const { data: resolvedVariants } = useQuery({
		queryKey: ['bundle-component-names', componentIds.join(',')],
		queryFn: () => findVariantsByIds(componentIds),
		enabled: componentIds.length > 0,
		staleTime: 5 * 60 * 1000,
	});

	const chosen = new Set(value.map((component) => component.variant_id));

	return (
		<div className="space-y-6">
			<div className="space-y-2">
				<h3 className="text-sm font-medium">Choices</h3>

				<p className="text-xs text-muted">
					A choice is what says <em>exactly one of these</em>. It is
					not optional - the bundle always contains one candidate, and
					the customer only decides which - so its candidates are{' '}
					<strong>base</strong> components naming it below. It needs
					at least two of them.
				</p>

				{groupsSetError && (
					<p className="text-xs text-danger">
						{groupsSetError.join(' ')}
					</p>
				)}

				{groups.map((group, index) => (
					<GroupRow
						key={group.key}
						group={group}
						index={index}
						pending={pending}
						errors={groupErrors}
						candidates={
							value.filter(
								(component) =>
									component.group_key === group.key,
							).length
						}
						canCreateTerm={canCreateTerm}
						onChange={(next) =>
							onGroupsChange(
								groups.map((entry, entryIndex) =>
									entryIndex === index ? next : entry,
								),
							)
						}
						onRemove={() => removeGroup(index)}
						onCreateTerm={onCreateTerm}
					/>
				))}

				{/*
				 * Below the prompts rather than beside the heading: the button appends to the
				 * list, so it sits where the row it writes will appear.
				 */}
				<Button
					type="button"
					variant="outline"
					disabled={pending}
					onClick={() => onGroupsChange([...groups, emptyGroup()])}
				>
					<Icons.Action.Add className="h-4 w-4" />
					Add a choice
				</Button>
			</div>

			{/*
			 * Two lists, because which one a component sits in is the whole of whether the
			 * customer decides on it - a field saying so as well would be the same fact twice.
			 * Base first: it is what the bundle is, and the floor is counted over it alone.
			 */}
			<ComponentSection
				title="Base components"
				hint="Always included, and covered by the bundle price - either outright or through a choice, which always takes one of its candidates. Two units contained outright, or the bundle is a single product; a candidate does not count, since which one is taken is the customer's."
				deltaHint="A candidate carries an adjustment per market: taking it adds its own price plus that adjustment. Since the bundle price already covers the candidate, the adjustment is usually its whole price, negative, so nothing is added."
				emptyText="No base components yet. A bundle needs one with a quantity of 2, or two different ones."
				searchKey="base"
				pending={pending}
				entries={baseEntries}
				chosen={chosen}
				errors={errors}
				setError={setError}
				currencies={currencies}
				groups={groups}
				resolvedVariants={resolvedVariants}
				onAdd={(variant) =>
					onChange([...value, emptyComponent(variant)])
				}
				onChangeAt={updateAt}
				onRemoveAt={(index) =>
					onChange(
						value.filter((_, entryIndex) => entryIndex !== index),
					)
				}
				onMoveAt={moveAt}
			/>

			<ComponentSection
				title="Optional components"
				hint="The customer may take these or leave them, up to the quantity on each."
				deltaHint="Every unit taken adds the component's own price plus the adjustment on its row. Usually negative - the discount for taking it inside the kit."
				emptyText="Nothing optional. The bundle is a fixed kit as it stands."
				searchKey="optional"
				pending={pending}
				entries={optionalEntries}
				chosen={chosen}
				errors={errors}
				currencies={currencies}
				groups={groups}
				resolvedVariants={resolvedVariants}
				onAdd={(variant) =>
					onChange([
						...value,
						{ ...emptyComponent(variant), is_optional: true },
					])
				}
				onChangeAt={updateAt}
				onRemoveAt={(index) =>
					onChange(
						value.filter((_, entryIndex) => entryIndex !== index),
					)
				}
				onMoveAt={moveAt}
			/>

			{/*
			 * The whole list in one hidden field. Per-input names cannot express a nested
			 * repeatable, and `getProductBundleFormValues` parses this back - `position` is
			 * assigned from the array order on the way out, so it is not an input either.
			 */}
			<input
				type="hidden"
				name="components"
				value={JSON.stringify(value)}
			/>

			{/* Same device, one level up - a group is a repeatable with no leaf fields of its own */}
			<input type="hidden" name="groups" value={JSON.stringify(groups)} />
		</div>
	);
}
