'use client';

import type { JSX } from 'react';
import { dispatchDataTableAction } from '@/app/(dashboard)/_events/data-table-action.event';
import { formatDate } from '@/helpers/date.helper';
import {
	DisplayDeleted,
	DisplayStatus,
	type statusList,
} from '@/helpers/display.helper';
import { getErrorMessage } from '@/helpers/error.helper';
import { requestView } from '@/helpers/services.helper';
import { capitalizeFirstLetter } from '@/helpers/string.helper';
import { useToast } from '@/providers/toast.provider';
import type { DataSourceKey } from '@/types/data-source.key';
import type {
	DataTableColumnType,
	DataTableValueOptionsType,
} from '@/types/data-source.type';
import type { ButtonAppearanceType } from '@/types/html.type';

export const DisplayButton = <Entry,>({
	buttonAppearance,
	action,
	dataSource,
	entryOrId,
}: {
	buttonAppearance: ButtonAppearanceType;
	action: string;
	dataSource: DataSourceKey;
	entryOrId: Entry | number;
}) => {
	const { showToast } = useToast();

	return (
		<button
			type="button"
			className="cursor-pointer hover:underline"
			onClick={async () => {
				try {
					const entry =
						typeof entryOrId === 'number'
							? await requestView<Entry>(dataSource, entryOrId)
							: entryOrId;

					dispatchDataTableAction({
						dataSource,
						action,
						entries: [entry],
					});
				} catch (error) {
					showToast({
						severity: 'error',
						summary: `Failed to resolve entry for action "${action}"`,
						detail: getErrorMessage(error),
					});
				}
			}}
			title={buttonAppearance.title}
		>
			{buttonAppearance.label}
		</button>
	);
};

export const DataTableValue = <Entry extends Record<string, unknown>>(
	entry: Entry,
	column: DataTableColumnType<Entry> | keyof Entry,
	options: DataTableValueOptionsType<Entry>,
) => {
	let outputValue: string | JSX.Element;

	const field = typeof column === 'object' ? column.field : column;

	if (options.customValue) {
		outputValue = options.customValue;
	} else {
		const entryValue = entry[field] as string | object;

		if (entryValue == null) {
			return '-';
		}

		if (typeof entryValue === 'object') {
			outputValue = Object.values(entryValue).join(', ');
		} else {
			outputValue = entryValue;
		}
	}

	if (options.capitalize && typeof outputValue === 'string') {
		outputValue = capitalizeFirstLetter(outputValue);
	}

	if (options.uppercase && typeof outputValue === 'string') {
		outputValue = outputValue.toUpperCase();
	}

	if (options.displayDate && typeof outputValue === 'string') {
		outputValue = formatDate(outputValue, 'date-time') || '-';
	}

	if (options.isStatus && field === 'status' && 'status' in entry) {
		const status =
			options.markDeleted && 'deleted_at' in entry && entry?.deleted_at
				? 'deleted'
				: (entry.status as keyof typeof statusList);

		if (!options.dataSource) {
			throw new Error('dataSource is required for `DisplayStatus`');
		}

		outputValue = (
			<DisplayStatus status={status} dataSource={options.dataSource} />
		);
	} else if (options.markDeleted && 'deleted_at' in entry) {
		outputValue = (
			<DisplayDeleted
				value={outputValue}
				isDeleted={!!entry?.deleted_at}
			/>
		);
	}

	if (options.displayButton) {
		const {
			action,
			title,
			alternateEntryId,
			dataSource: displayButtonDataSource,
		} = options.displayButton;

		const resolvedAction =
			typeof action === 'function' ? action(entry) : action;

		if (resolvedAction) {
			// If displayButtonDataSource is provided, use it, otherwise use options.dataSource
			const displayButtonDataSourceValue =
				displayButtonDataSource || options.dataSource;

			if (!displayButtonDataSourceValue) {
				throw new Error('dataSource is required for `DisplayButton`');
			}

			outputValue = (
				<DisplayButton
					buttonAppearance={{
						label: outputValue,
						title: title,
					}}
					action={resolvedAction}
					dataSource={displayButtonDataSourceValue}
					entryOrId={alternateEntryId ?? entry}
				/>
			);
		}
	}

	return outputValue;
};
