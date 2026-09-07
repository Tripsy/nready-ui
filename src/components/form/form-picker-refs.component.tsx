/*
 * No `'use client'`: this is not a boundary, only a piece of the forms that are. Carrying the
 * directive would make it a client *entry*, and an entry's props have to be serializable — the
 * callbacks below are ordinary functions passed between client components, which the Next TS
 * plugin can only read as unserializable ones.
 */
import { useQueryClient } from '@tanstack/react-query';
import { type JSX, type ReactNode, useState } from 'react';
import { FormComponentAutoComplete } from '@/components/form/form-element.component';
import { Icons } from '@/components/icon.component';
import { requestFind } from '@/helpers/services.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useRemoteAutocomplete } from '@/hooks/use-remote-autocomplete';
import { useModalStore } from '@/stores/window.store';
import type { FindFunctionResponseType } from '@/types/action.type';
import type { DataSourceKey } from '@/types/data-source.key';
import { DataSourceSectionEnum } from '@/types/data-source.type';

/** One chip: whatever the caller resolved the selection to. */
export type PickerRefType = {
	id: number;
	label: string;
};

type Props<Model extends { id: number }> = {
	labelText: string;
	/**
	 * The name the selection is submitted under. The search box gets a `_search` suffix
	 * instead: `FormComponentAutoComplete` gives its visible input `name={fieldName}`, so
	 * sharing the name submits the half-typed query as an extra entry.
	 */
	fieldName: string;
	dataSource: DataSourceKey;
	/** Extra filter params the data source needs beyond `term` (e.g. `{ type: 'tag' }`). */
	filter?: Record<string, string>;
	getOptionLabel: (entry: Model) => string;
	/**
	 * The selection as chips. The caller resolves ids to labels because the two hosts hold
	 * them differently — one carries the label in its form value, the other keeps a map keyed
	 * by id — and nothing here depends on where they came from.
	 */
	entries: readonly PickerRefType[];
	/** Called for a pick the selection does not already hold; deduplication happens here. */
	onSelect: (entry: Model) => void;
	onRemove: (id: number) => void;
	/**
	 * The selection as real form fields. `processForm` rebuilds its values from `FormData` on
	 * every submit, so a selection that lived only in React state would be dropped — and the
	 * encoding is the host's business: one JSON field where the labels have to survive a failed
	 * submit, one input per id where they do not.
	 */
	hiddenFields: ReactNode;
	/**
	 * Namespaces the suggestion cache. Two pickers over the same data source — an article's
	 * categories and a product's — would otherwise share cached searches under one key.
	 */
	queryKeyPrefix: string;
	/**
	 * The line shown while nothing is selected. Omit it where an empty selection needs no
	 * explanation — the row then collapses to the search box, and a validation error still
	 * takes its place.
	 */
	emptyText?: string;
	/** Validation messages for the selection as a whole, not for any one entry. */
	error?: string[];
	isRequired?: boolean;
	disabled?: boolean;
	/**
	 * Offers "create" once a search returns nothing, seeding the data source's own create
	 * window from the typed text. Omit it and the picker only links what already exists.
	 */
	create?: {
		buildPrefillEntry: (value: string) => Record<string, unknown>;
		createLabel?: (value: string) => string;
	};
};

/**
 * Search a data source, add rows, remove them — the shared half of every reference picker.
 *
 * What it owns: the search box, the remote suggestions and their cache key, deduplication, the
 * chips and the empty/error line. What it does not own: how the selection reaches `FormData`
 * (`hiddenFields`) and how an id becomes a label (`entries`).
 */
export function FormPickerRefs<Model extends { id: number }>({
	labelText,
	fieldName,
	dataSource,
	filter,
	getOptionLabel,
	entries,
	onSelect,
	onRemove,
	hiddenFields,
	queryKeyPrefix,
	emptyText,
	error,
	isRequired = false,
	disabled = false,
	create,
}: Props<Model>): JSX.Element {
	const elementKey = `picker-${fieldName}`;
	const suggestionsKey = `${queryKeyPrefix}-${fieldName}`;

	// One line for both states: an error is what the empty selection has to say once the form
	// has been submitted, so it replaces `emptyText` rather than stacking under it.
	const emptyLine = error?.length ? error.join(' ') : emptyText;

	const { open, focus, getCurrentWindow } = useModalStore();
	const queryClient = useQueryClient();

	const [search, setSearch] = useState('');
	const elementIds = useElementIds([elementKey]);

	const { suggestions, isFetching } = useRemoteAutocomplete<Model>({
		query: search,
		queryKey: [suggestionsKey],
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

		if (entries.some((existing) => existing.id === entry.id)) {
			return;
		}

		onSelect(entry);
	};

	/**
	 * Hands the typed text to the data source's own create window, then links whatever comes
	 * back. Reusing that window is what keeps the new entry a complete record — a tag needs a
	 * type and a translation per language, none of which fit in a search box.
	 *
	 * `open` minimizes the form this picker sits in, so the parent is captured beforehand and
	 * focused again on success; without it the editor lands on an empty desktop with their
	 * half-filled form parked in the dock.
	 */
	const createEntry = (typedValue: string) => {
		const parentWindow = getCurrentWindow();

		open({
			minimized: false,
			section: DataSourceSectionEnum.DASHBOARD,
			dataSource,
			action: 'create',
			data: { prefillEntry: create?.buildPrefillEntry(typedValue) },
			events: {
				success: async (entry?: Model) => {
					if (parentWindow) {
						focus(parentWindow.uid);
					}

					if (!entry) {
						return;
					}

					addEntry(entry);

					// The searches already run are cached for five minutes, and the term the
					// editor just typed is one of them — holding the empty result that sent
					// them here in the first place.
					await queryClient.invalidateQueries({
						queryKey: [suggestionsKey],
					});
				},
			},
		});
	};

	return (
		<div className="space-y-2">
			<FormComponentAutoComplete<Record<string, never>, Model>
				labelText={labelText}
				id={elementIds[elementKey]}
				fieldName={`${fieldName}_search`}
				fieldValue={search}
				isRequired={isRequired}
				placeholderText={`Search ${labelText.toLowerCase()}…`}
				className="w-full pl-8"
				disabled={disabled}
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
					allowCreate: !!create,
					onCreate: createEntry,
					createLabel: create?.createLabel,
				}}
			/>

			{hiddenFields}

			{entries.length === 0 ? (
				emptyLine ? (
					<p
						className={
							error?.length
								? 'text-sm text-danger'
								: 'text-sm text-muted'
						}
					>
						{emptyLine}
					</p>
				) : null
			) : (
				<ul className="flex flex-wrap gap-2">
					{entries.map((entry) => (
						<li
							key={entry.id}
							className="flex items-center gap-1 rounded-md border border-line px-2 py-1 text-sm"
						>
							<span>{entry.label}</span>
							<button
								type="button"
								aria-label={`Remove ${entry.label}`}
								disabled={disabled}
								onClick={() => onRemove(entry.id)}
								className="opacity-60 hover:opacity-100"
							>
								<Icons.Close className="h-3.5 w-3.5" />
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
