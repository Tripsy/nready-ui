'use client';

import { type JSX, useMemo } from 'react';
import { useStore } from 'zustand/react';
import {
	FormFiltersDateRange,
	FormFiltersReset,
	FormFiltersSearch,
	FormFiltersSelect,
} from '@/app/(dashboard)/_components/form-filters.component';
import { useDataTable } from '@/app/(dashboard)/_providers/data-table.provider';
import type { MailQueueDataTableFiltersType } from '@/app/(dashboard)/dashboard/mail-queue/mail-queue.definition';
import { toOptionsFromEnum } from '@/helpers/form.helper';
import {
	enumTranslationKeys,
	translateEnumLabel,
} from '@/helpers/string.helper';
import { useDataTableFilterReset } from '@/hooks/use-data-table-filter-reset.hook';
import { useSearchFilter } from '@/hooks/use-search-filter.hook';
import { useSetFilterValues } from '@/hooks/use-set-filter-values.hook';
import { useTranslation } from '@/hooks/use-translation.hook';
import {
	type MailQueueStatus,
	MailQueueStatusEnum,
} from '@/models/mail-queue.model';

const TRANSLATION_KEYS = [
	'mail-queue.field.content',
	'mail-queue.field.sent_at',
	'mail-queue.field.status',
	'mail-queue.field.template',
	'mail-queue.field.to',
	...enumTranslationKeys('mail-queue.status', MailQueueStatusEnum),
] as const;

export const DataTableFiltersMailQueue = (): JSX.Element => {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const statuses = useMemo(
		() =>
			toOptionsFromEnum(MailQueueStatusEnum, {
				formatter: (value) =>
					translateEnumLabel(
						translations,
						'mail-queue.status',
						value,
					),
			}),
		[translations],
	);

	const { dataSource, dataTableStateDefault, dataTableStore } =
		useDataTable<'mail-queue'>();

	const filters = useStore(
		dataTableStore,
		(state) => state.tableState.filters,
	) as MailQueueDataTableFiltersType;

	const updateTableState = useStore(
		dataTableStore,
		(state) => state.updateTableState,
	);

	const { setFilterValue } =
		useSetFilterValues<MailQueueDataTableFiltersType>(
			dataTableStore,
			updateTableState,
		);

	const searchTemplate = useSearchFilter({
		initialValue: filters.template.value ?? '',
		debounceDelay: 1000,
		minLength: 1,
		onSearch: (value) => setFilterValue('template', value),
	});

	const searchContent = useSearchFilter({
		initialValue: filters.content.value ?? '',
		debounceDelay: 1000,
		minLength: 3,
		onSearch: (value) => setFilterValue('content', value),
	});

	const searchTo = useSearchFilter({
		initialValue: filters.to.value ?? '',
		debounceDelay: 1000,
		minLength: 3,
		onSearch: (value) => setFilterValue('to', value),
	});

	const resetCallbacks = useMemo(
		() => [searchTemplate.onReset, searchContent.onReset, searchTo.onReset],
		[searchTemplate.onReset, searchContent.onReset, searchTo.onReset],
	);

	useDataTableFilterReset({
		dataSource,
		defaultFilters: dataTableStateDefault.filters,
		updateTableState,
		onReset: resetCallbacks,
	});

	return (
		<div className="form-section flex-row flex-wrap gap-4 border-b border-line pb-4">
			<FormFiltersDateRange<MailQueueDataTableFiltersType>
				labelText={translations['mail-queue.field.sent_at']}
				start={{
					fieldName: 'sent_at_start',
					fieldValue: filters.sent_at_start.value,
					onSelect: (value) => setFilterValue('sent_at_start', value),
				}}
				end={{
					fieldName: 'sent_at_end',
					fieldValue: filters.sent_at_end.value,
					onSelect: (value) => setFilterValue('sent_at_end', value),
				}}
			/>

			<FormFiltersSelect<MailQueueDataTableFiltersType>
				labelText={translations['mail-queue.field.status']}
				fieldName="status"
				fieldValue={filters.status.value}
				options={statuses}
				onChange={(value) =>
					setFilterValue('status', value as MailQueueStatus)
				}
			/>

			<FormFiltersSearch<MailQueueDataTableFiltersType>
				labelText={translations['mail-queue.field.template']}
				fieldName="template"
				search={searchTemplate}
			/>

			<FormFiltersSearch<MailQueueDataTableFiltersType>
				labelText={translations['mail-queue.field.content']}
				fieldName="content"
				search={searchContent}
			/>

			<FormFiltersSearch<MailQueueDataTableFiltersType>
				labelText={translations['mail-queue.field.to']}
				fieldName="to"
				search={searchTo}
			/>

			<FormFiltersReset dataSource="mail-queue" />
		</div>
	);
};
