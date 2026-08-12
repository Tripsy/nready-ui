'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStore } from 'zustand/react';
import { addDataTableActionListener } from '@/app/(dashboard)/_events/data-table-action.event';
import { useDataTable } from '@/app/(dashboard)/_providers/data-table.provider';
import {
	ActionButton,
	type ButtonCommand,
} from '@/components/action-button.component';
import { getDataSourceConfig } from '@/config/data-source.config';
import { getErrorMessage } from '@/helpers/error.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import { hasPermission } from '@/models/auth.model';
import { UserRoleEnum } from '@/models/user.model';
import { useAuth } from '@/providers/auth.provider';
import { useToast } from '@/providers/toast.provider';
import { useModalStore } from '@/stores/window.store';
import type { EntriesSelectionType } from '@/types/action.type';
import type { DataSourceKey, DatasourceModels } from '@/types/data-source.key';
import {
	type ActionConfigPermission,
	type ActionConfigType,
	DataSourceSectionEnum,
} from '@/types/data-source.type';
import type { ButtonAppearanceType } from '@/types/html.type';

type HandleActionType<K extends DataSourceKey> = (
	action: string,
	dataSource: DataSourceKey,
	entries: DatasourceModels[K][],
	actionConfig?: ActionConfigType<DatasourceModels[K]>,
) => void;

type AllowActionType<K extends DataSourceKey> = (
	entries: DatasourceModels[K][],
	permission: ActionConfigPermission | undefined,
	entriesSelection: EntriesSelectionType,
	customEntryCheck?: (entry: DatasourceModels[K]) => boolean,
) => boolean;

function DataTableActionButton({
	dataSource,
	action,
	disabled = false,
	buttonAppearance,
	command,
}: {
	dataSource: string;
	action: string;

	disabled?: boolean;
	buttonAppearance?: ButtonAppearanceType;
	command: ButtonCommand;
}) {
	const actionTitleKey = `${dataSource}.action.${action}.title`;
	const actionLabelKey = `${dataSource}.action.${action}.label`;

	const translationsKeys = [
		actionTitleKey,
		actionLabelKey,
		'app.action.loading.label',
	] as const;

	const { translations, isTranslationLoading } =
		useTranslation(translationsKeys);

	if (isTranslationLoading) {
		return null;
	}

	return (
		<ActionButton
			action={action}
			buttonAppearance={{
				...buttonAppearance,
				title: buttonAppearance?.title ?? translations[actionTitleKey],
				label: buttonAppearance?.label ?? translations[actionLabelKey],
				loadingLabel:
					buttonAppearance?.loadingLabel ??
					translations['app.action.loading.label'],
			}}
			disabled={disabled}
			command={command}
		/>
	);
}

function buildActionButtons<K extends DataSourceKey>(
	position: 'left' | 'right',
	actions: Record<string, ActionConfigType<DatasourceModels[K]>>,
	dataSource: DataSourceKey,
	selectedEntries: DatasourceModels[K][],
	allowAction: AllowActionType<K>,
	handleAction: HandleActionType<K>,
) {
	return Object.entries(actions)
		.filter(
			([, actionConfig]) =>
				actionConfig.buttonPosition === position &&
				(selectedEntries.length > 0 ||
					actionConfig.entriesSelection === 'free') &&
				allowAction(
					selectedEntries,
					actionConfig.permission,
					actionConfig.entriesSelection,
					actionConfig.customEntryCheck,
				),
		)
		.map(([action, actionConfig]) => {
			let command: ButtonCommand;

			if (actionConfig.windowType === 'link') {
				command = {
					type: 'link',
					href: actionConfig.windowTarget ?? '/',
				};
			} else {
				command = {
					type: 'action',
					onClick: () =>
						handleAction(
							action,
							dataSource,
							selectedEntries,
							actionConfig,
						),
				};
			}

			return (
				<DataTableActionButton
					key={`button-${dataSource}-${action}`}
					dataSource={dataSource}
					action={action}
					buttonAppearance={actionConfig.button}
					command={command}
				/>
			);
		});
}

function resolveActionEntries<K extends DataSourceKey>(
	entries: DatasourceModels[K][],
	entriesSelection: EntriesSelectionType,
): DatasourceModels[K][] {
	if (entriesSelection === 'free') {
		return [];
	}

	if (entriesSelection === 'single') {
		return entries[0] ? [entries[0]] : [];
	}

	return entries;
}

export function DataTableActions<K extends DataSourceKey>() {
	type Entry = DatasourceModels[K];

	const { dataSource, selectionMode, dataTableStore } = useDataTable<K>();
	const { auth } = useAuth();
	const { showToast } = useToast();
	const { open } = useModalStore();

	const selectedEntries = useStore(
		dataTableStore,
		(state) => state.selectedEntries,
	);

	const [actions, setActions] = useState<
		Record<string, ActionConfigType<Entry>> | undefined
	>(undefined);

	useEffect(() => {
		getDataSourceConfig(
			DataSourceSectionEnum.DASHBOARD,
			dataSource,
			'actions',
		).then(setActions);
	}, [dataSource]);

	const translationsKeys = [
		'app.error.operation_not_allowed',
		'app.error.title',
	] as const;

	const { translations } = useTranslation(translationsKeys);

	const allowAction: AllowActionType<K> = useCallback(
		(
			entries: Entry[],
			permission: ActionConfigPermission | undefined,
			entriesSelection: EntriesSelectionType,
			customEntryCheck?: (entry: Entry) => boolean,
		) => {
			if (entriesSelection === 'single') {
				if (entries.length !== 1) {
					return false;
				}

				if (customEntryCheck && !customEntryCheck(entries[0])) {
					return false;
				}
			}

			if (entriesSelection === 'multiple' && entries.length === 0) {
				return false;
			}

			// No declared permission → the action isn't permission-gated.
			if (!permission) {
				return true;
			}

			const [permissionEntity, permissionOperation] = permission;

			if (
				auth?.role === UserRoleEnum.DRIVER &&
				!['find', 'read'].includes(permissionOperation)
			) {
				return false;
			}

			return hasPermission(auth, permissionEntity, permissionOperation);
		},
		[auth],
	);

	const handleActionError = useCallback(
		(error: unknown) => {
			showToast({
				severity: 'error',
				summary: translations['app.error.title'],
				detail: getErrorMessage(error),
			});
		},
		[showToast, translations],
	);

	const handleAction: HandleActionType<K> = useCallback(
		(action, targetDataSource, entries, actionConfig) => {
			const execute = async () => {
				const resolvedActionConfig =
					actionConfig ??
					(targetDataSource === dataSource
						? actions?.[action]
						: (
								await getDataSourceConfig(
									DataSourceSectionEnum.DASHBOARD,
									targetDataSource,
									'actions',
								)
							)?.[action]);

				if (!resolvedActionConfig) {
					throw new Error(`Action "${action}" is not defined`);
				}

				if (
					!allowAction(
						entries,
						resolvedActionConfig.permission,
						resolvedActionConfig.entriesSelection,
						resolvedActionConfig.customEntryCheck,
					)
				) {
					throw new Error(
						translations['app.error.operation_not_allowed'],
					);
				}

				const actionEntries = resolveActionEntries(
					entries,
					resolvedActionConfig.entriesSelection,
				);

				open({
					minimized: false,
					section: DataSourceSectionEnum.DASHBOARD,
					dataSource: targetDataSource,
					action,
					data: { entries: actionEntries },
				});
			};

			execute().catch(handleActionError);
		},
		[
			actions,
			allowAction,
			open,
			translations,
			handleActionError,
			dataSource,
		],
	);

	useEffect(() => {
		return addDataTableActionListener<Entry>(
			({ action, dataSource, entries }) => {
				handleAction(action, dataSource, entries);
			},
		);
	}, [handleAction]);

	const [leftActions, rightActions] = useMemo(
		() =>
			actions
				? [
						buildActionButtons(
							'left',
							actions,
							dataSource,
							selectedEntries,
							allowAction,
							handleAction,
						),
						buildActionButtons(
							'right',
							actions,
							dataSource,
							selectedEntries,
							allowAction,
							handleAction,
						),
					]
				: [null, null],
		[actions, dataSource, selectedEntries, allowAction, handleAction],
	);

	const hasContent =
		selectionMode === 'multiple' ||
		(leftActions?.length ?? 0) > 0 ||
		(rightActions?.length ?? 0) > 0;

	// Nothing to show (no permitted actions, no selection counter) — an empty bar would
	// still claim its padding and reserved height.
	if (!hasContent) {
		return null;
	}

	/*
	 * The reserved height keeps the table from jumping as selection-dependent buttons come
	 * and go, which only holds while the row stays one line — from `md` up. Narrower than
	 * that the buttons wrap, so the height changes regardless and the reservation would
	 * only cost vertical space the viewport does not have.
	 */
	return (
		<div className="flex flex-wrap gap-4 justify-between md:min-h-18.5 py-4">
			<div className="flex flex-wrap gap-4 items-center">
				{selectionMode === 'multiple' && (
					<div>{selectedEntries.length} selected</div>
				)}
				{leftActions}
			</div>
			<div className="flex flex-wrap gap-4">{rightActions}</div>
		</div>
	);
}
