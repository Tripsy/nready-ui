'use client';

import { type JSX, useState } from 'react';
import { FormComponentAutoComplete } from '@/components/form/form-element.component';
import { Icons } from '@/components/icon.component';
import { requestFind } from '@/helpers/services.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useRemoteAutocomplete } from '@/hooks/use-remote-autocomplete';
import type { FindFunctionResponseType } from '@/types/action.type';
import type { DataSourceKey } from '@/types/data-source.key';

type Props<Model extends { id: number }> = {
	labelText: string;
	/** Name of the hidden inputs carrying the selection into `FormData`. */
	fieldName: string;
	dataSource: DataSourceKey;
	/** Extra filter params the data source needs beyond `term` (e.g. `{ type: 'tag' }`). */
	filter?: Record<string, string>;
	getOptionLabel: (entry: Model) => string;
	/** Selected ids. The only thing that reaches the API. */
	value: readonly number[];
	onChange: (ids: number[]) => void;
	emptyText: string;
	disabled?: boolean;
	/** Validation messages for the selection as a whole, not for any one entry. */
	error?: string[];
};

/**
 * Search-and-add picker for an article's categories or tags.
 *
 * The selection is a list of ids held in form state and mirrored into hidden inputs, because
 * `processForm` rebuilds its values from `FormData` on every submit — anything not rendered as
 * a field would be dropped.
 *
 * Labels are cached here, keyed by id, purely so the chips read as names. Ids loaded from the
 * API start as `#12` until the user searches for them; nothing depends on a label being present.
 */
export function FormPickerArticle<Model extends { id: number }>({
	labelText,
	fieldName,
	dataSource,
	filter,
	getOptionLabel,
	value,
	onChange,
	emptyText,
	disabled,
	error,
}: Props<Model>): JSX.Element {
	const elementKey = `picker-${fieldName}`;

	const [search, setSearch] = useState('');
	const [labels, setLabels] = useState<Record<number, string>>({});
	const elementIds = useElementIds([elementKey]);

	const { suggestions, isFetching } = useRemoteAutocomplete<Model>({
		query: search,
		queryKey: [`s-article-${fieldName}`],
		queryFn: async (term) => {
			const response: FindFunctionResponseType<Model> | undefined =
				await requestFind(dataSource, {
					filter: { term, ...filter },
					limit: 10,
				});

			return response?.entries ?? [];
		},
		minLength: 3,
	});

	const addEntry = (entry: Model) => {
		setSearch('');
		setLabels((current) => ({
			...current,
			[entry.id]: getOptionLabel(entry),
		}));

		if (value.includes(entry.id)) {
			return;
		}

		onChange([...value, entry.id]);
	};

	const removeEntry = (id: number) => {
		onChange(value.filter((existing) => existing !== id));
	};

	return (
		<div className="space-y-2">
			<FormComponentAutoComplete<Record<string, never>, Model>
				labelText={labelText}
				id={elementIds[elementKey]}
				fieldName={`article-${fieldName}-search`}
				fieldValue={search}
				placeholderText={`Search ${labelText.toLowerCase()}…`}
				className="w-full pl-8"
				disabled={disabled ?? false}
				onInputChange={setSearch}
				icons={{
					left: <Icons.Search className="opacity-40 h-4.5 w-4.5" />,
				}}
				autoCompleteProps={{
					suggestions,
					isLoading: isFetching,
					onSelect: addEntry,
					getOptionLabel,
					getOptionKey: (entry) => entry.id,
				}}
			/>

			{/*
			 * The ids as real form fields. `processForm` reads `FormData`, so a selection that
			 * lived only in React state would not survive a submit.
			 */}
			{value.map((id) => (
				<input key={id} type="hidden" name={fieldName} value={id} />
			))}

			{value.length === 0 ? (
				<p
					className={
						error?.length
							? 'text-sm text-danger'
							: 'text-sm text-muted'
					}
				>
					{error?.length ? error.join(' ') : emptyText}
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
