'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { Icons } from '@/components/icon.component';
import {
	ErrorComponent,
	LoadingComponent,
} from '@/components/status.component';
import { Button } from '@/components/ui/button';
import { DisplayStatus } from '@/helpers/display.helper';
import { requestFind } from '@/helpers/services.helper';
import { type CmrModel, displayCmrLabel } from '@/models/cmr.model';
import type { CmrSessionModel } from '@/models/cmr-session.model';
import { useModalStore } from '@/stores/window.store';
import { DataSourceSectionEnum } from '@/types/data-source.type';

export function SetupCmrSessions({ entries }: { entries: CmrModel[] }) {
	const { open, focus, getCurrentWindow } = useModalStore();

	const windowConfig = getCurrentWindow();

	const queryClient = useQueryClient();

	const cmrModel = entries[0];
	const cmrId = cmrModel?.id;

	const {
		data: cmrSession,
		isLoading: isLoadingCmrSession,
		error: errorCmrSession,
	} = useQuery({
		queryKey: ['cmr-session', cmrId],
		queryFn: () =>
			requestFind<CmrSessionModel>('cmr-session', {
				// TODO why not requestView
				filter: {
					cmr_id: cmrId as number,
				},
			}),
		enabled: !!cmrId,
	});

	const invalidateCmrSession = useCallback(
		() =>
			queryClient.invalidateQueries({
				queryKey: ['cmr-session', cmrId],
			}),
		[queryClient, cmrId],
	);

	const openCreate = useCallback(() => {
		open({
			minimized: false,
			section: DataSourceSectionEnum.DASHBOARD,
			dataSource: 'cmr-session',
			action: 'create',
			data: {
				prefillEntry: {
					cmr: cmrModel,
				},
			},
			events: {
				success: async () => {
					await invalidateCmrSession();

					// Back to `setup-cmr-session`
					if (windowConfig) {
						focus(windowConfig.uid);
					}
				},
				close: async () => {
					// Back to `setup-cmr-session`
					if (windowConfig) {
						focus(windowConfig.uid);
					}
				},
			},
		});
	}, [open, cmrModel, invalidateCmrSession, focus, windowConfig]);

	const onDelete = useCallback(
		(entry: CmrSessionModel) => {
			open({
				minimized: false,
				section: DataSourceSectionEnum.DASHBOARD,
				dataSource: 'cmr-session',
				action: 'delete',
				data: {
					entries: [entry],
				},
				events: {
					success: async () => {
						await invalidateCmrSession();
					},
					close: async () => {
						// Back to `setup-cmr-session`
						if (windowConfig) {
							focus(windowConfig.uid);
						}
					},
				},
			});
		},
		[open, invalidateCmrSession, focus, windowConfig],
	);

	if (!cmrModel) {
		return <ErrorComponent />;
	}

	if (errorCmrSession) {
		return <ErrorComponent description={errorCmrSession.message} />;
	}

	if (isLoadingCmrSession) {
		return <LoadingComponent />;
	}

	return (
		<div>
			{(cmrSession?.entries?.length ?? 0) > 0 ? (
				<div className="overflow-x-auto rounded-lg border border-border shadow-sm">
					<table className="min-w-full divide-y divide-border">
						<thead className="bg-surface-secondary">
							<tr>
								<th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
									CMR
								</th>
								<th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
									User
								</th>
								<th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
									Work Session Status
								</th>
								<th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">
									Actions
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border bg-surface">
							{cmrSession?.entries.map((v) => (
								<CmrSessionEntry
									key={v.id}
									m={v}
									onDelete={onDelete}
								/>
							))}
						</tbody>
					</table>
				</div>
			) : (
				<div className="text-center py-8 px-4 bg-surface-secondary rounded-lg border border-border">
					<Icons.CmrSession className="mx-auto h-12 w-12 text-muted" />
					<p className="mt-2 text-sm text-muted">No sessions set</p>
				</div>
			)}

			<div className="mt-4">
				<Button
					type="button"
					variant="success"
					onClick={openCreate}
					title="Add session"
					className="inline-flex items-center gap-2"
				>
					<Icons.CmrSession /> Add session
				</Button>
			</div>
		</div>
	);
}

type CmrSessionEntryProps = {
	m: CmrSessionModel;
	onDelete: (entry: CmrSessionModel) => void;
};

function CmrSessionEntry({ m, onDelete }: CmrSessionEntryProps) {
	return (
		<tr className="hover:bg-surface-secondary/50 transition-colors duration-150">
			<td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-surface-foreground">
				{displayCmrLabel(m.cmr)}
			</td>
			<td className="px-4 py-4 whitespace-nowrap text-sm text-surface-foreground">
				{m.work_session.user.name}
			</td>
			<td className="px-4 py-4 whitespace-nowrap text-sm text-surface-foreground">
				<DisplayStatus
					status={m.work_session.status}
					dataSource="work-session"
				/>
			</td>
			<td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
				<button
					type="button"
					onClick={() => onDelete(m)}
					className="cursor-pointer text-danger hover:text-danger/80 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-danger focus:ring-offset-2 rounded focus:ring-offset-background"
					title="Delete session"
				>
					<Icons.Action.Delete className="h-4 w-4" />
				</button>
			</td>
		</tr>
	);
}
