/*
 * No `'use client'`: this is not a boundary, only a piece of `form-manage-discount`, which
 * already runs in the client graph. Carrying the directive would make it a client *entry*,
 * and an entry's props have to be serializable — the callbacks below are ordinary functions
 * passed between client components, which the Next TS plugin can only read as unserializable
 * ones.
 */
import { type JSX, useState } from 'react';
import { FormComponentAutoComplete } from '@/components/form/form-element.component';
import { Icons } from '@/components/icon.component';
import { getLanguageClient } from '@/config/translate.setup';
import { requestFind } from '@/helpers/services.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useRemoteAutocomplete } from '@/hooks/use-remote-autocomplete';
import { type BrandModel, displayBrandLabel } from '@/models/brand.model';
import {
	type CategoryModel,
	displayCategoryLabel,
} from '@/models/category.model';
import { type ClientModel, displayClientLabel } from '@/models/client.model';
import {
	DiscountScopeEnum,
	type DiscountTargetScope,
} from '@/models/discount.model';
import type { FindFunctionResponseType } from '@/types/action.type';
import type { DataSourceKey } from '@/types/data-source.key';

/**
 * The dashboard data source behind each scope's picker, and how to label a row from it.
 *
 * `product` and `variant` are absent on purpose: neither has a dashboard feature, so there is
 * nothing to search. The backend still stores and serves their links — the form says so rather
 * than offering a picker that could only ever come back empty.
 *
 * TODO: add both once the product dashboard exists. Combined with the "pick at least one
 * target" rule, their absence is what stops a product- or variant-scoped discount being saved
 * from this form at all. See the TODO in `../nready-api/README.md` for the full list.
 */
const TARGET_SOURCES: Partial<
	Record<
		DiscountTargetScope,
		{
			dataSource: DataSourceKey;
			label: string;
			// biome-ignore lint/suspicious/noExplicitAny: one map over three unrelated models
			getOptionLabel: (entry: any) => string;
			/** Extra filter params the data source needs beyond `term`. */
			filter?: Record<string, string>;
		}
	>
> = {
	[DiscountScopeEnum.CLIENT]: {
		dataSource: 'client',
		label: 'Clients',
		getOptionLabel: (entry: ClientModel) => displayClientLabel(entry),
	},
	[DiscountScopeEnum.CATEGORY]: {
		dataSource: 'category',
		label: 'Categories',
		/*
		 * The backend defaults this filter to `article`, so without it a discount could only
		 * ever be pointed at blog categories — never at the product tree it is meant for.
		 */
		filter: { type: 'product' },
		getOptionLabel: (entry: CategoryModel) =>
			displayCategoryLabel(entry, getLanguageClient(), false),
	},
	[DiscountScopeEnum.BRAND]: {
		dataSource: 'brand',
		label: 'Brands',
		getOptionLabel: (entry: BrandModel) => displayBrandLabel(entry),
	},
};

type Props = {
	scope: DiscountTargetScope;
	/** Selected owner ids. The only thing that reaches the API. */
	value: readonly number[];
	onChange: (ids: number[]) => void;
	disabled?: boolean;
	isLoading?: boolean;
	/** Validation messages for the selection as a whole, not for any one entry. */
	error?: string[];
};

/**
 * Search-and-add picker for a discount's targets.
 *
 * The selection itself is a list of ids, held in form state, and mirrored into hidden inputs so
 * it survives `processForm` — which rebuilds its values from `FormData` on every submit, so
 * anything not rendered as a field would be dropped.
 *
 * Labels are cached here instead, keyed by id, purely so the chips read as names rather than
 * numbers. They are a display convenience: ids loaded from the API start as `#12` until the
 * user searches, and nothing depends on them being present.
 */
export function FormTargetsDiscount({
	scope,
	value,
	onChange,
	disabled,
	isLoading,
	error,
}: Props): JSX.Element {
	const [search, setSearch] = useState('');
	const [labels, setLabels] = useState<Record<number, string>>({});
	const elementIds = useElementIds(['target'] as const);

	const source = TARGET_SOURCES[scope];

	const { suggestions, isFetching } = useRemoteAutocomplete<
		Record<string, unknown>
	>({
		query: search,
		queryKey: [`s-discount-target-${scope}`],
		queryFn: async (term) => {
			if (!source) {
				return [];
			}

			const response:
				| FindFunctionResponseType<Record<string, unknown>>
				| undefined = await requestFind(source.dataSource, {
				filter: { term, ...source.filter },
				limit: 10,
			});

			return response?.entries ?? [];
		},
		minLength: 3,
	});

	if (!source) {
		return (
			<div className="rounded-md border border-line p-3 text-sm text-muted">
				Targets for the <strong>{scope}</strong> scope are stored by the
				API but cannot be picked here yet — there is no {scope}{' '}
				dashboard to search.
			</div>
		);
	}

	const addEntry = (id: number, label: string) => {
		setSearch('');
		setLabels((current) => ({ ...current, [id]: label }));

		if (value.includes(id)) {
			return;
		}

		onChange([...value, id]);
	};

	const removeEntry = (id: number) => {
		onChange(value.filter((existing) => existing !== id));
	};

	return (
		<div className="space-y-2">
			<FormComponentAutoComplete<
				Record<string, never>,
				Record<string, unknown>
			>
				labelText={`Targeted ${source.label}`}
				id={elementIds.target}
				fieldName="discount-target"
				fieldValue={search}
				placeholderText={`Search ${source.label.toLowerCase()}…`}
				className="w-full pl-8"
				disabled={disabled || isLoading || false}
				onInputChange={setSearch}
				icons={{
					left: <Icons.Search className="opacity-40 h-4.5 w-4.5" />,
				}}
				autoCompleteProps={{
					suggestions,
					isLoading: isFetching,
					onSelect: (entry) =>
						addEntry(
							entry.id as number,
							source.getOptionLabel(entry),
						),
					getOptionLabel: (entry) => source.getOptionLabel(entry),
					getOptionKey: (entry) => entry.id as number,
				}}
			/>

			{/*
			 * The ids as real form fields. `processForm` reads `FormData`, so a selection that
			 * lived only in React state would not survive a submit.
			 */}
			{value.map((id) => (
				<input key={id} type="hidden" name="target_id" value={id} />
			))}

			{isLoading ? (
				<p className="text-sm text-muted">Loading current targets…</p>
			) : value.length === 0 ? (
				// The validator says the same thing once the form is submitted; until then this
				// is the quieter version of it.
				<p
					className={
						error?.length
							? 'text-sm text-danger'
							: 'text-sm text-muted'
					}
				>
					{error?.length
						? error.join(' ')
						: 'No targets yet — this discount will not apply to anything.'}
				</p>
			) : (
				<ul className="flex flex-wrap gap-2">
					{value.map((id) => {
						const label = labels[id] ?? `#${id}`;

						return (
							<li
								key={id}
								className="flex items-center gap-1 rounded-md border border-line px-2 py-1 text-sm"
							>
								<span>{label}</span>
								<button
									type="button"
									aria-label={`Remove ${label}`}
									disabled={disabled}
									onClick={() => removeEntry(id)}
									className="opacity-60 hover:opacity-100"
								>
									<Icons.Close className="h-3.5 w-3.5" />
								</button>
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}
