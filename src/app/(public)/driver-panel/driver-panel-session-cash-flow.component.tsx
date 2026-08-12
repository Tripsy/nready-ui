import { useCallback } from 'react';
import { useDriverCashBalance } from '@/app/(public)/_hooks/use-driver-cash-balance.hook';
import { useWorkSession } from '@/app/(public)/_providers/work-session.provider';
import { Icons } from '@/components/icon.component';
import { Button } from '@/components/ui/button';
import { DisplayAmount, DisplayStatus } from '@/helpers/display.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import {
	CashFlowDirectionEnum,
	CashFlowMethodEnum,
	type CashFlowModel,
	CashFlowStatusEnum,
} from '@/models/cash-flow.model';
import { displayClientLabel } from '@/models/client.model';
import { displayVendorLabel } from '@/models/vendor.model';
import { useModalStore } from '@/stores/window.store';
import { CurrencyEnum } from '@/types/common.type';
import { DataSourceSectionEnum } from '@/types/data-source.type';

const TRANSLATION_KEYS = [
	'driver-panel.field.client',
	'driver-panel.field.amount',
	'driver-panel.field.reference',
	'driver-panel.field.vendor',
	'driver-panel.field.notes',
	'driver-panel.tooltip.update_payment',
	'driver-panel.tooltip.mark_complete',
	'driver-panel.tooltip.mark_canceled',
] as const;

export function DriverPanelSessionCashFlow({
	entries,
}: {
	entries: CashFlowModel[];
}) {
	// One call refreshes every currency balance (the cash-flow list can move any
	// of them); the currency arg only satisfies the hook signature.
	const { invalidateAll } = useDriverCashBalance(CurrencyEnum.RON);

	return (
		<div className="space-y-4">
			{entries.map((m) => (
				<div
					key={m.id}
					className="bg-surface border border-border rounded-lg p-4"
				>
					<DriverPanelSessionCashFlowEntry
						entry={m}
						onBalanceInvalidate={invalidateAll}
					/>
				</div>
			))}
		</div>
	);
}

function DriverPanelSessionCashFlowEntry({
	entry,
	onBalanceInvalidate,
}: {
	entry: CashFlowModel;
	onBalanceInvalidate: () => Promise<void>;
}) {
	const open = useModalStore((s) => s.open);
	const { refetchSessionCashFlowEntries } = useWorkSession();
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const handleUpdateCashFlow = useCallback(
		(entry: CashFlowModel) => {
			open({
				minimized: false,
				section: DataSourceSectionEnum.PUBLIC,
				dataSource: 'cash-flow',
				action: 'update',
				data: {
					entries: [entry],
				},
				events: {
					success: async () => {
						await refetchSessionCashFlowEntries();
					},
				},
			});
		},
		[open, refetchSessionCashFlowEntries],
	);

	const handleCompleteCashFlow = useCallback(
		(entry: CashFlowModel) => {
			open({
				minimized: false,
				section: DataSourceSectionEnum.PUBLIC,
				dataSource: 'cash-flow',
				action: 'complete',
				data: {
					entries: [entry],
				},
				events: {
					success: async () => {
						await refetchSessionCashFlowEntries();

						if (entry.method === CashFlowMethodEnum.CASH) {
							await onBalanceInvalidate();
						}
					},
				},
			});
		},
		[open, refetchSessionCashFlowEntries, onBalanceInvalidate],
	);

	const handleCancelCashFlow = useCallback(
		(entry: CashFlowModel) => {
			open({
				minimized: false,
				section: DataSourceSectionEnum.PUBLIC,
				dataSource: 'cash-flow',
				action: 'cancel',
				data: {
					entries: [entry],
				},
				events: {
					success: async () => {
						await refetchSessionCashFlowEntries();
					},
				},
			});
		},
		[open, refetchSessionCashFlowEntries],
	);

	return (
		<div className="flex justify-between">
			<div className="flex flex-col justify-between items-start self-stretch gap-2">
				<h3 className="font-semibold text-surface-foreground flex items-center gap-4">
					<div className="flex items-center gap-1">
						{entry.direction === CashFlowDirectionEnum.IN ? (
							<Icons.Direction.ArrowRight className="h-4 w-4 text-success" />
						) : (
							<Icons.Direction.ArrowLeft className="h-4 w-4 text-danger dark:text-warning" />
						)}
						{formatEnumLabel(entry.method)} #{entry.id}
					</div>
					<div>
						<DisplayStatus
							status={entry.status}
							dataSource="cash-flow"
						/>
					</div>
				</h3>
				{entry.operational_records?.client && (
					<div>
						<span className="text-muted">
							{translations['driver-panel.field.client']}:
						</span>
						<span className="ml-2 font-mono">
							{displayClientLabel(
								entry.operational_records.client,
							)}
						</span>
					</div>
				)}
				<div>
					<span className="text-muted">
						{translations['driver-panel.field.amount']}:
					</span>
					<span className="ml-2 font-mono">
						<DisplayAmount
							amount={entry.grossAmount}
							currencyCode={entry.currency}
							classNamePositive="text-success"
						/>
					</span>
				</div>
				{entry.external_reference && (
					<div>
						<span className="text-muted">
							{translations['driver-panel.field.reference']}:
						</span>
						<span className="ml-2 font-mono">
							{entry.external_reference}
						</span>
					</div>
				)}
				{entry.operational_records?.vendor && (
					<div>
						<span className="text-muted">
							{translations['driver-panel.field.vendor']}:
						</span>
						<span className="ml-2 font-mono">
							{displayVendorLabel(
								entry.operational_records.vendor,
							)}
						</span>
					</div>
				)}
				{entry.notes && (
					<div>
						<span className="text-muted">
							{translations['driver-panel.field.notes']}:
						</span>
						<span className="ml-2 font-mono">{entry.notes}</span>
					</div>
				)}
			</div>

			<div className="flex flex-col justify-start gap-4">
				{entry.status === CashFlowStatusEnum.PENDING && (
					<Button
						variant="secondary"
						hover="default"
						onClick={() => handleUpdateCashFlow(entry)}
						className="cursor-pointer"
						title={
							translations['driver-panel.tooltip.update_payment']
						}
					>
						<Icons.Action.Update className="h-4 w-4" />
					</Button>
				)}
				{entry.status === CashFlowStatusEnum.PENDING &&
					entry.method === CashFlowMethodEnum.CASH && (
						<>
							<Button
								variant="secondary"
								hover="default"
								onClick={() => handleCompleteCashFlow(entry)}
								className="cursor-pointer"
								title={
									translations[
										'driver-panel.tooltip.mark_complete'
									]
								}
							>
								<Icons.Action.Complete className="h-4 w-4" />
							</Button>
							<Button
								variant="secondary"
								hover="error"
								onClick={() => handleCancelCashFlow(entry)}
								className="cursor-pointer"
								title={
									translations[
										'driver-panel.tooltip.mark_canceled'
									]
								}
							>
								<Icons.Action.Cancel className="h-4 w-4" />
							</Button>
						</>
					)}
			</div>
		</div>
	);
}
