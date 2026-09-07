import type { JSX } from 'react';
import { FormPickerRefs } from '@/components/form/form-picker-refs.component';
import type { ProductRefType } from '@/models/product.model';
import type { DataSourceKey } from '@/types/data-source.key';

type Props = {
	labelText: string;
	fieldName: string;
	dataSource: DataSourceKey;
	// biome-ignore lint/suspicious/noExplicitAny: one picker over two unrelated models
	getOptionLabel: (entry: any) => string;
	/** Extra filter params the data source needs beyond `term`. */
	filter?: Record<string, string>;
	value: ProductRefType[];
	onChange: (value: ProductRefType[]) => void;
	isRequired?: boolean;
	disabled?: boolean;
	emptyText?: string;
	error?: string[];
};

/**
 * The product side of `FormPickerRefs`: a selection of `{ id, label }`, submitted as one JSON
 * field.
 *
 * The label travels in the value rather than being looked up, which is what lets the chips
 * render after a failed submit - `processForm` echoes the submitted values back, and one input
 * per id would return the ids without their names, blanking every chip.
 */
export function FormPickerProduct({
	labelText,
	fieldName,
	dataSource,
	getOptionLabel,
	filter,
	value,
	onChange,
	isRequired = false,
	disabled = false,
	emptyText,
	error,
}: Props): JSX.Element {
	return (
		<FormPickerRefs<Record<string, unknown> & { id: number }>
			labelText={labelText}
			fieldName={fieldName}
			dataSource={dataSource}
			filter={filter}
			getOptionLabel={getOptionLabel}
			entries={value}
			onSelect={(entry) =>
				onChange([
					...value,
					{ id: entry.id, label: getOptionLabel(entry) },
				])
			}
			onRemove={(id) =>
				onChange(value.filter((entry) => entry.id !== id))
			}
			hiddenFields={
				<input
					type="hidden"
					name={fieldName}
					value={JSON.stringify(value)}
				/>
			}
			queryKeyPrefix="s-product-ref"
			emptyText={emptyText}
			error={error}
			isRequired={isRequired}
			disabled={disabled}
		/>
	);
}
