/*
 * No `'use client'`: this is not a boundary, only a piece of `form-manage-article`, which is.
 * Carrying the directive would make it a client *entry*, and an entry's props have to be
 * serializable — the callbacks below are ordinary functions passed between client components,
 * which the Next TS plugin can only read as unserializable ones.
 */
import { useQueryClient } from '@tanstack/react-query';
import { type JSX, useState } from 'react';
import { FormComponentAutoComplete } from '@/components/form/form-element.component';
import { Icons } from '@/components/icon.component';
import { requestFind } from '@/helpers/services.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useRemoteAutocomplete } from '@/hooks/use-remote-autocomplete';
import { useModalStore } from '@/stores/window.store';
import type { FindFunctionResponseType } from '@/types/action.type';
import type { DataSourceKey } from '@/types/data-source.key';
import { DataSourceSectionEnum } from '@/types/data-source.type';

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
	/**
	 * Seeds the data source's own create window from the text typed into the search box, and
	 * offers the option once a search returns nothing. Omit it and the picker only links what
	 * already exists.
	 */
	buildPrefillEntry?: (value: string) => Record<string, unknown>;
	/** Wording for the create option; the typed text is passed in. */
	createLabel?: (value: string) => string;
	/**
	 * Labels for the ids the form starts with, so the chips read as names before the editor
	 * searches for anything. Ids missing from it fall back to `#id`.
	 */
	initialLabels?: Record<number, string>;
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
	buildPrefillEntry,
	createLabel,
	initialLabels,
}: Props<Model>): JSX.Element {
	const elementKey = `picker-${fieldName}`;
	const suggestionsKey = `s-article-${fieldName}`;

	const { open, focus, getCurrentWindow } = useModalStore();
	const queryClient = useQueryClient();

	const [search, setSearch] = useState('');
	// Seeded once: everything picked afterwards is added by `addEntry`, and re-seeding on a
	// prop change would undo a label the editor's own search just resolved.
	const [labels, setLabels] = useState<Record<number, string>>(
		() => initialLabels ?? {},
	);
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

	/**
	 * Hands the typed text to the data source's own create window, then links whatever comes
	 * back. Reusing that window is what keeps the new entry a complete record — a tag needs a
	 * type and a translation per language, none of which fit in a search box.
	 *
	 * `open` minimizes the form this picker sits in, so the parent is captured beforehand and
	 * focused again on success; without it the editor lands on an empty desktop with their
	 * half-filled article parked in the dock.
	 */
	const createEntry = (typedValue: string) => {
		const parentWindow = getCurrentWindow();

		open({
			minimized: false,
			section: DataSourceSectionEnum.DASHBOARD,
			dataSource,
			action: 'create',
			data: { prefillEntry: buildPrefillEntry?.(typedValue) },
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
					allowCreate: !!buildPrefillEntry,
					onCreate: createEntry,
					createLabel,
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
