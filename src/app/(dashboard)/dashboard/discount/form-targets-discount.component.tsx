import { useQuery } from '@tanstack/react-query';
import { type JSX, useEffect, useState } from 'react';
import {
	findTargetLabels,
	TARGET_SOURCES,
} from '@/app/(dashboard)/dashboard/discount/target-source';
import { FormComponentAutoComplete } from '@/components/form/form-element.component';
import { Icons } from '@/components/icon.component';
import { requestFind } from '@/helpers/services.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useRemoteAutocomplete } from '@/hooks/use-remote-autocomplete';
import type { DiscountTargetScope } from '@/models/discount.model';
import type { FindFunctionResponseType } from '@/types/action.type';

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
 * it survives `processForm` - which rebuilds its values from `FormData` on every submit, so
 * anything not rendered as a field would be dropped.
 *
 * Labels are kept beside it, keyed by id, purely so the chips read as names rather than numbers.
 * They are a display convenience and nothing depends on them being present: a row picked in this
 * session is named by the search result it came from, a row loaded from the API by the lookup
 * below, and anything neither resolves falls back to `#12`.
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

	/*
	 * The ids that still have no name - the stored selection, which reaches the form as bare
	 * ids. What the user adds by searching is named on the spot by `addEntry`, so it never
	 * enters this set and adding a chip costs no request.
	 */
	const missingIds = value.filter((id) => labels[id] === undefined);

	const { data: resolvedLabels } = useQuery({
		queryKey: ['discount', 'target-labels', scope, missingIds],
		queryFn: () => findTargetLabels(scope, missingIds),
		enabled: missingIds.length > 0,
	});

	/*
	 * Merged into the cache so the resolved ids leave `missingIds`, which is what settles the
	 * query. An id the listing did not return - a target whose row was soft-deleted after the
	 * link was made - is pinned to its own `#12` for the same reason: left unresolved it would
	 * be asked for again on every refetch.
	 */
	useEffect(() => {
		if (!resolvedLabels) {
			return;
		}

		setLabels((current) => {
			const merged = { ...current };

			for (const id of missingIds) {
				merged[id] = resolvedLabels[id] ?? `#${id}`;
			}

			return merged;
		});
	}, [resolvedLabels, missingIds]);

	const { suggestions, isFetching } = useRemoteAutocomplete<
		Record<string, unknown>
	>({
		query: search,
		queryKey: [`s-discount-target-${scope}`],
		queryFn: async (term) => {
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
						: 'No targets yet - this discount will not apply to anything.'}
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
