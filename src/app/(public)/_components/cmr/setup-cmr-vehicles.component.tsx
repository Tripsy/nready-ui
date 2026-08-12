'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { Icons } from '@/components/icon.component';
import {
	ErrorComponent,
	LoadingComponent,
} from '@/components/status.component';
import { Button } from '@/components/ui/button';
import { requestFind } from '@/helpers/services.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import type { CmrModel } from '@/models/cmr.model';
import type { CmrVehicleModel } from '@/models/cmr-vehicle.model';
import { displayVehicleLabel } from '@/models/vehicle.model';
import { useModalStore } from '@/stores/window.store';
import { DataSourceSectionEnum } from '@/types/data-source.type';

const TRANSLATION_KEYS = [
	'cmr-vehicle.button.add',
	'cmr-vehicle.button.update',
	'cmr-vehicle.button.delete',
] as const;

type CmrVehicleLabels = Record<(typeof TRANSLATION_KEYS)[number], string>;

export function SetupCmrVehicles({ entries }: { entries: CmrModel[] }) {
	const { translations } = useTranslation(TRANSLATION_KEYS);
	const { open, focus, getCurrentWindow } = useModalStore();

	const windowConfig = getCurrentWindow();

	const queryClient = useQueryClient();

	const cmrModel = entries[0];
	const cmrId = cmrModel?.id;

	const {
		data: cmrVehicle,
		isLoading: isLoadingCmrVehicle,
		error: errorCmrVehicle,
	} = useQuery({
		queryKey: ['cmr-vehicle', cmrId],
		queryFn: () =>
			requestFind<CmrVehicleModel>('cmr-vehicle', {
				// TODO why not requestView
				filter: {
					cmr_id: cmrId as number,
				},
			}),
		enabled: !!cmrId,
	});

	const invalidateCmrVehicle = useCallback(
		() =>
			queryClient.invalidateQueries({
				queryKey: ['cmr-vehicle', cmrId],
			}),
		[queryClient, cmrId],
	);

	const openCreate = useCallback(() => {
		open({
			minimized: false,
			section: DataSourceSectionEnum.PUBLIC,
			dataSource: 'cmr-vehicle',
			action: 'create',
			data: {
				prefillEntry: {
					cmr: cmrModel,
				},
			},
			events: {
				success: async () => {
					await invalidateCmrVehicle();

					// Back to `setup-cmr-vehicle`
					if (windowConfig) {
						focus(windowConfig.uid);
					}
				},
				close: async () => {
					// Back to `setup-cmr-vehicle`
					if (windowConfig) {
						focus(windowConfig.uid);
					}
				},
			},
		});
	}, [open, cmrModel, invalidateCmrVehicle, focus, windowConfig]);

	const onUpdate = useCallback(
		(entry: CmrVehicleModel) => {
			open({
				minimized: false,
				section: DataSourceSectionEnum.PUBLIC,
				dataSource: 'cmr-vehicle',
				action: 'update',
				data: {
					entries: [entry],
				},
				events: {
					success: async () => {
						await invalidateCmrVehicle();

						// Back to `setup-cmr-vehicle`
						if (windowConfig) {
							focus(windowConfig.uid);
						}
					},
					close: async () => {
						// Back to `setup-cmr-vehicle`
						if (windowConfig) {
							focus(windowConfig.uid);
						}
					},
				},
			});
		},
		[open, invalidateCmrVehicle, focus, windowConfig],
	);

	const onDelete = useCallback(
		(entry: CmrVehicleModel) => {
			open({
				minimized: false,
				section: DataSourceSectionEnum.PUBLIC,
				dataSource: 'cmr-vehicle',
				action: 'delete',
				data: {
					entries: [entry],
				},
				events: {
					success: async () => {
						await invalidateCmrVehicle();
					},
					close: async () => {
						// Back to `setup-cmr-vehicle`
						if (windowConfig) {
							focus(windowConfig.uid);
						}
					},
				},
			});
		},
		[open, invalidateCmrVehicle, focus, windowConfig],
	);

	if (!cmrModel) {
		return <ErrorComponent />;
	}

	if (errorCmrVehicle) {
		return <ErrorComponent description={errorCmrVehicle.message} />;
	}

	if (isLoadingCmrVehicle) {
		return <LoadingComponent />;
	}

	return (
		<div>
			{(cmrVehicle?.entries?.length ?? 0) > 0 ? (
				<div className="overflow-x-auto rounded-lg border border-border shadow-sm">
					<table className="min-w-full divide-y divide-border">
						<thead className="bg-surface-secondary">
							<tr>
								<th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
									Vehicle
								</th>
								<th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
									Identification
								</th>
								<th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
									Notes
								</th>
								<th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">
									Actions
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border bg-surface">
							{cmrVehicle?.entries.map((v) => (
								<CmrVehicleEntry
									labels={translations}
									key={v.id}
									m={v}
									onUpdate={onUpdate}
									onDelete={onDelete}
								/>
							))}
						</tbody>
					</table>
				</div>
			) : (
				<div className="text-center py-8 px-4 bg-surface-secondary rounded-lg border border-border">
					<Icons.Vehicle className="mx-auto h-12 w-12 text-muted" />
					<p className="mt-2 text-sm text-muted">No vehicles set</p>
				</div>
			)}

			<div className="mt-4">
				<Button
					type="button"
					variant="success"
					onClick={openCreate}
					title={translations['cmr-vehicle.button.add']}
					className="inline-flex items-center gap-2"
				>
					<Icons.Vehicle /> {translations['cmr-vehicle.button.add']}
				</Button>
			</div>
		</div>
	);
}

type CmrVehicleEntryProps = {
	m: CmrVehicleModel;
	onUpdate: (entry: CmrVehicleModel) => void;
	onDelete: (entry: CmrVehicleModel) => void;
	labels: CmrVehicleLabels;
};

function CmrVehicleEntry({
	m,
	onUpdate,
	onDelete,
	labels,
}: CmrVehicleEntryProps) {
	return (
		<tr className="hover:bg-surface-secondary/50 transition-colors duration-150">
			<td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-surface-foreground">
				{displayVehicleLabel(m.vehicle)}
			</td>
			<td className="px-4 py-4 whitespace-nowrap text-sm text-surface-foreground">
				{m.license_plate} {m.vin && <span>/ {m.vin}</span>}
			</td>
			<td className="px-4 py-4 whitespace-nowrap text-sm text-surface-foreground">
				{m.notes ?? '-'}
			</td>
			<td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
				<div className="flex gap-3 items-center justify-end">
					<button
						type="button"
						onClick={() => onUpdate(m)}
						className="cursor-pointer text-accent hover:text-accent-hover transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2 rounded focus:ring-offset-background"
						title={labels['cmr-vehicle.button.update']}
					>
						<Icons.Action.Update className="h-4 w-4" />
					</button>
					<span className="text-border">/</span>
					<button
						type="button"
						onClick={() => onDelete(m)}
						className="cursor-pointer text-danger hover:text-danger/80 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-danger focus:ring-offset-2 rounded focus:ring-offset-background"
						title={labels['cmr-vehicle.button.delete']}
					>
						<Icons.Action.Delete className="h-4 w-4" />
					</button>
				</div>
			</td>
		</tr>
	);
}
