import { Label } from '@heroui/react';
import type { JSX } from 'react';
import { dispatchFilterReset } from '@/app/(dashboard)/_events/data-table-filter-reset.event';
import {
	FormComponentAutoComplete,
	FormComponentCalendarWithoutFormElement,
	FormComponentCheckbox,
	FormComponentInput,
	FormComponentSelect,
	type GroupedOptionsType,
	type InputValueType,
	type OptionsType,
	type OptionValueType,
} from '@/components/form/form-element.component';
import { Icons } from '@/components/icon.component';
import { Button } from '@/components/ui/button';
import { cn } from '@/helpers/css.helper';
import { stringToDate } from '@/helpers/date.helper';
import { requestFind } from '@/helpers/services.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useRemoteAutocomplete } from '@/hooks/use-remote-autocomplete';
import type { useSearchFilter } from '@/hooks/use-search-filter.hook';
import { useTranslation } from '@/hooks/use-translation.hook';
import { hasPermission } from '@/models/auth.model';
import { useAuth } from '@/providers/auth.provider';
import type { FindFunctionResponseType } from '@/types/action.type';
import type { DataSourceKey } from '@/types/data-source.key';
import type { DataTableFiltersType } from '@/types/data-source.type';

export function FormFiltersAutoComplete<
	Fields extends DataTableFiltersType,
	Model,
>({
	labelText,
	fieldName,
	fieldNameId,
	fieldValue,
	className,
	icons,
	setFilterValues,
	setSearch,
	dataSourceKey,
	getOptionLabel,
	getOptionKey,
}: {
	labelText: string;
	fieldName: keyof Fields & string;
	fieldNameId: keyof Fields & string;
	fieldValue: string;
	className?: string;
	icons?: { left?: JSX.Element; right?: JSX.Element };
	setFilterValues: (
		updates: Partial<{ [K in keyof Fields]: Fields[K]['value'] }>,
	) => void;
	setSearch: (value: string) => void;
	dataSourceKey: DataSourceKey;
	getOptionLabel: (m: Model) => string;
	getOptionKey: (m: Model) => number;
}) {
	const elementKey = `search-${String(fieldName)}`;
	const elementIds = useElementIds([elementKey]);

	const { suggestions, isFetching } = useRemoteAutocomplete<Model>({
		query: fieldValue,
		queryKey: [`s-${fieldName}`],
		queryFn: async (q) => {
			const res: FindFunctionResponseType<Model> | undefined =
				await requestFind(dataSourceKey, {
					filter: { term: q },
					limit: 10,
				});

			return res?.entries ?? [];
		},
		minLength: 3,
	});

	return (
		<FormComponentAutoComplete<Fields, Model>
			labelText={labelText}
			id={elementIds[elementKey]}
			fieldName={fieldName}
			fieldValue={fieldValue}
			className={className}
			disabled={false}
			onInputChange={(value) => {
				setSearch(value);
				setFilterValues({
					[fieldName]: null,
					[fieldNameId]: null,
				} as Partial<{ [K in keyof Fields]: Fields[K]['value'] }>);
			}}
			autoCompleteProps={{
				suggestions: suggestions,
				isLoading: isFetching,
				onSelect: (m) => {
					const label = getOptionLabel(m);
					const key = getOptionKey(m);

					setSearch(label);
					setFilterValues({
						[fieldName]: label,
						[fieldNameId]: key,
					} as Partial<{ [K in keyof Fields]: Fields[K]['value'] }>);
				},
				getOptionLabel,
				getOptionKey,
			}}
			icons={icons}
		/>
	);
}

export function FormFiltersSearch<Fields>({
	labelText,
	fieldName,
	placeholderText = 'Search',
	search,
	className,
}: {
	labelText: string;
	fieldName?: keyof Fields & string;
	placeholderText?: string;
	search: ReturnType<typeof useSearchFilter>;
	className?: string;
}) {
	const elementKey = `search-${String(fieldName)}`;
	const elementIds = useElementIds([elementKey]);

	return (
		<FormComponentInput<Fields>
			labelText={labelText}
			id={elementIds[elementKey]}
			fieldName={fieldName || ('global' as keyof Fields & string)}
			fieldValue={search.value}
			className={cn('pl-8 max-w-64', className)}
			placeholderText={placeholderText}
			icons={{
				left: <Icons.Search className="opacity-40 h-4.5 w-4.5" />,
			}}
			disabled={false}
			onChange={search.handler}
		/>
	);
}

export function FormFiltersSelect<Fields>({
	labelText,
	fieldName,
	fieldValue,
	placeholderText = 'Select...',
	options,
	onChange,
	className,
}: {
	labelText: string;
	fieldName: keyof Fields & string;
	fieldValue: OptionValueType;
	placeholderText?: string;
	options: OptionsType | GroupedOptionsType;
	onChange: (value: string) => void;
	className?: string;
}) {
	const elementKey = `search-${String(fieldName)}`;
	const elementIds = useElementIds([elementKey]);

	return (
		<FormComponentSelect
			labelText={labelText}
			id={elementIds[elementKey]}
			fieldName={fieldName}
			fieldValue={fieldValue}
			className={cn('max-w-64 min-w-32', className)}
			disabled={false}
			placeholderText={placeholderText}
			options={options}
			onChange={onChange}
		/>
	);
}

type FormFilterDateRangeElementType<K> = {
	fieldName: K & string;
	fieldValue: InputValueType;
	placeholderText?: string;
	onSelect: (value: string) => void;
};

export function FormFiltersDateRange<Fields>({
	labelText,
	start,
	end,
}: {
	labelText: string;
	start: FormFilterDateRangeElementType<keyof Fields>;
	end: FormFilterDateRangeElementType<keyof Fields>;
}) {
	const elementKeyStart = `search-${String(start.fieldName)}`;
	const elementKeyEnd = `search-${String(end.fieldName)}`;
	const elementIds = useElementIds([elementKeyStart, elementKeyEnd]);

	const translationsKeys = [
		'dashboard.text.placeholder_start_date',
		'dashboard.text.placeholder_end_date',
	] as const;

	const { translations } = useTranslation(translationsKeys);

	const maxDate = end.fieldValue ? stringToDate(end.fieldValue) : undefined;
	const minDate = start.fieldValue
		? stringToDate(start.fieldValue)
		: undefined;

	return (
		<div className="flex flex-col gap-3 h-full">
			<Label htmlFor={elementIds[elementKeyStart]}>{labelText}</Label>
			<div className="flex flex-wrap gap-2">
				<FormComponentCalendarWithoutFormElement
					id={elementIds[elementKeyStart]}
					fieldName={start.fieldName}
					fieldValue={start.fieldValue}
					placeholderText={
						translations['dashboard.text.placeholder_start_date']
					}
					// Falls back to the group label for the tick before the async
					// translations resolve, so the picker is never left unnamed.
					ariaLabel={
						translations['dashboard.text.placeholder_start_date'] ??
						labelText
					}
					disabled={false}
					onSelect={start.onSelect}
					maxDate={maxDate}
				/>
				<FormComponentCalendarWithoutFormElement
					id={elementIds[elementKeyEnd]}
					fieldName={end.fieldName}
					fieldValue={end.fieldValue}
					placeholderText={
						translations['dashboard.text.placeholder_end_date']
					}
					ariaLabel={
						translations['dashboard.text.placeholder_end_date'] ??
						labelText
					}
					disabled={false}
					onSelect={end.onSelect}
					minDate={minDate}
				/>
			</div>
		</div>
	);
}

export function FormFiltersShowDeleted({
	dataSource,
	checked = false,
	onCheckedChange,
}: {
	dataSource: DataSourceKey;
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
}) {
	const { auth } = useAuth();

	const elementIds = useElementIds(['search-is-deleted'] as const);

	const translationsKeys = [
		'dashboard.text.label_checkbox_show_deleted',
	] as const;

	const { translations } = useTranslation(translationsKeys);

	if (!auth || !hasPermission(auth, dataSource, 'delete')) {
		return null;
	}

	return (
		<div className="flex self-end pb-3">
			<FormComponentCheckbox
				id={elementIds['search-is-deleted']}
				onCheckedChange={onCheckedChange}
				fieldName="terms"
				checked={checked}
				disabled={false}
			>
				{translations['dashboard.text.label_checkbox_show_deleted']}
			</FormComponentCheckbox>
		</div>
	);
}

export function FormFiltersReset({
	dataSource,
}: {
	dataSource: DataSourceKey;
}) {
	const translationsKeys = ['dashboard.text.label_reset'] as const;

	const { translations } = useTranslation(translationsKeys);

	return (
		<div className="flex self-end">
			<Button
				type="reset"
				variant="outline"
				hover="warning"
				onClick={() => dispatchFilterReset(dataSource)}
				title="Reset filters"
			>
				<Icons.Action.Reset />
				{translations['dashboard.text.label_reset']}
			</Button>
		</div>
	);
}
