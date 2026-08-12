'use client';

import { useState } from 'react';
import { dispatchFilterReset } from '@/app/(dashboard)/_events/data-table-filter-reset.event';
import { ActionButton } from '@/components/action-button.component';
import { LoadingComponent } from '@/components/status.component';
import { ApiError } from '@/exceptions/api.error';
import ValueError from '@/exceptions/value.error';
import { replaceVars } from '@/helpers/string.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import { useToast } from '@/providers/toast.provider';
import { useModalStore } from '@/stores/window.store';
import type {
	ActionOperationMultipleFunctionType,
	ActionOperationSingleFunctionType,
} from '@/types/action.type';
import type { DataSourceKey } from '@/types/data-source.key';
import { DataSourceSectionEnum } from '@/types/data-source.type';
import type { ButtonAppearanceType } from '@/types/html.type';
import type { WindowEntryType } from '@/types/window.type';

export function WindowAction<WindowEntry extends WindowEntryType>({
	uid,
	entries,
}: {
	uid: string;
	entries: WindowEntry[];
}) {
	const [loading, setLoading] = useState(false);
	const { showToast } = useToast();

	const { getWindow, close } = useModalStore();

	const windowConfig = getWindow(uid);
	const windowDefinition = windowConfig?.definition;

	// Guards
	if (!windowConfig) {
		throw new Error(`Window config not found for uid: ${uid}`);
	}

	if (!windowDefinition) {
		throw new Error(`Window definition not found for uid: ${uid}`);
	}

	if (windowDefinition.entriesSelection === 'single' && entries.length > 1) {
		throw new ValueError(`Multiple entries provided for single action`);
	}

	// WindowAction only handles action operations.
	const operationFunction = windowDefinition.operationFunction;

	// + Guards
	if (!operationFunction || typeof operationFunction !== 'function') {
		throw new ValueError(
			`Operation function is not defined for uid: ${uid}`,
		);
	}

	const displayEntryLabel = windowDefinition.displayEntryLabel;

	if (!displayEntryLabel || typeof displayEntryLabel !== 'function') {
		throw new ValueError(
			`"displayEntryLabel" function is not defined for uid: ${uid}`,
		);
	}

	const windowEvents = windowConfig.events;

	const actionTitleKey = `${windowConfig.dataSource}.action.${windowConfig.action}.title`;
	const actionLabelKey = `${windowConfig.dataSource}.action.${windowConfig.action}.label`;
	const actionConfirmKey = `${windowConfig.dataSource}.action.${windowConfig.action}.confirm`;

	const translationsKeys = [
		actionTitleKey,
		actionLabelKey,
		actionConfirmKey,
		'app.error.description',
		'app.success.title',
		'app.error.title',
		'app.action.loading.label',
		'app.action.abort.title',
		'app.action.abort.label',
		'dashboard.text.selected_entries_one',
		'dashboard.text.selected_entries_many',
	] as const;

	const { translations, isTranslationLoading } =
		useTranslation(translationsKeys);

	const handleClose = () => {
		close(uid);
		windowEvents?.close?.();
	};

	const handleAction = async () => {
		setLoading(true);

		try {
			const fetchResponse =
				windowDefinition.entriesSelection === 'single'
					? await (
							operationFunction as ActionOperationSingleFunctionType<WindowEntry>
						)(entries[0])
					: await (
							operationFunction as ActionOperationMultipleFunctionType
						)(entries.map((e) => e.id as number));

			if (fetchResponse?.success) {
				showToast({
					severity: 'success',
					summary: translations['app.success.title'],
					detail: fetchResponse?.message,
				});

				if (windowConfig.section === DataSourceSectionEnum.DASHBOARD) {
					dispatchFilterReset(
						windowConfig.dataSource as DataSourceKey,
					);
				}

				windowEvents?.success?.();

				handleClose();
			} else {
				showToast({
					severity: 'error',
					summary: translations['app.error.title'],
					detail: fetchResponse?.message,
				});

				windowEvents?.error?.();
			}
		} catch (error) {
			showToast({
				severity: 'error',
				summary: 'Error',
				detail:
					error instanceof ValueError || error instanceof ApiError
						? error.message
						: translations['app.error.description'],
			});
		} finally {
			setLoading(false);
		}
	};

	const buttonAppearance: ButtonAppearanceType = {
		...windowDefinition.button,
		title: windowDefinition.button?.title ?? translations[actionTitleKey],
		label: windowDefinition.button?.label ?? translations[actionLabelKey],
		loadingLabel:
			windowDefinition.button?.loadingLabel ??
			translations['app.action.loading.label'],
	};

	if (isTranslationLoading) {
		return <LoadingComponent />;
	}

	return (
		<>
			<p className="pb-4 font-semibold">
				{replaceVars(
					entries.length === 1
						? translations['dashboard.text.selected_entries_one']
						: translations['dashboard.text.selected_entries_many'],
					{
						count: entries.length.toString(),
					},
				)}
			</p>
			<ul className="pb-4 italic list-disc ml-4">
				{entries.map((entry) => (
					<li key={`action-entry-${entry.id}`}>
						{displayEntryLabel(entry)}{' '}
						<span className="text-md">({`#${entry.id}`})</span>
					</li>
				))}
			</ul>
			<p className="pb-4 font-semibold">
				{translations[actionConfirmKey]}
			</p>

			<div className="flex justify-end gap-3">
				<ActionButton
					action="abort"
					buttonAppearance={{
						variant: 'outline',
						hover: 'warning',
						title: translations['app.action.abort.title'],
						icon: 'abort',
						label: translations['app.action.abort.label'],
					}}
					disabled={loading}
					command={{
						type: 'action',
						onClick: handleClose,
					}}
				/>
				<ActionButton
					action={windowConfig.action}
					buttonAppearance={buttonAppearance}
					disabled={loading}
					command={{
						type: 'action',
						onClick: handleAction,
					}}
				/>
			</div>
		</>
	);
}
