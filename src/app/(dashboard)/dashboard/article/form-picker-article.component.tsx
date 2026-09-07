import { type JSX, useMemo, useState } from 'react';
import { FormPickerRefs } from '@/components/form/form-picker-refs.component';
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
	emptyText?: string;
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
 * The article side of `FormPickerRefs`: a selection of ids, one hidden input each.
 *
 * Labels are cached here, keyed by id, purely so the chips read as names — ids loaded from the
 * API start as `#12` until the user searches for them, and nothing depends on a label being
 * present. That is the difference from the product picker, which carries labels in its value
 * because its payload is one JSON field.
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
	// Seeded once: everything picked afterwards is added below, and re-seeding on a prop change
	// would undo a label the editor's own search just resolved.
	const [labels, setLabels] = useState<Record<number, string>>(
		() => initialLabels ?? {},
	);

	const entries = useMemo(
		() => value.map((id) => ({ id, label: labels[id] ?? `#${id}` })),
		[value, labels],
	);

	return (
		<FormPickerRefs<Model>
			labelText={labelText}
			fieldName={fieldName}
			dataSource={dataSource}
			filter={filter}
			getOptionLabel={getOptionLabel}
			entries={entries}
			onSelect={(entry) => {
				setLabels((current) => ({
					...current,
					[entry.id]: getOptionLabel(entry),
				}));

				onChange([...value, entry.id]);
			}}
			onRemove={(id) =>
				onChange(value.filter((existing) => existing !== id))
			}
			hiddenFields={value.map((id) => (
				<input key={id} type="hidden" name={fieldName} value={id} />
			))}
			queryKeyPrefix="s-article"
			emptyText={emptyText}
			error={error}
			disabled={disabled}
			create={
				buildPrefillEntry
					? { buildPrefillEntry, createLabel }
					: undefined
			}
		/>
	);
}
