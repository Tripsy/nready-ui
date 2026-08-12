'use client';

import { useQuery } from '@tanstack/react-query';
import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { Configuration } from '@/config/settings.config';
import { formatDate } from '@/helpers/date.helper';
import { DisplayAmount, DisplayStatus } from '@/helpers/display.helper';
import { requestFind } from '@/helpers/services.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import {
	CashFlowCategoryEnum,
	type CashFlowModel,
	CashFlowStatusEnum,
} from '@/models/cash-flow.model';
import { displayClientLabel } from '@/models/client.model';
import { displayCmrLabel } from '@/models/cmr.model';
import { displayCompanyVehicleLabel } from '@/models/company-vehicle.model';
import type { OperationalRecordModel } from '@/models/operational-record.model';
import { displayUserLabel } from '@/models/user.model';
import { displayVendorLabel } from '@/models/vendor.model';
import { requestOperationalRecords } from '@/services/cash-flow.service';

function ViewCashFlowRefunds({ refunds }: { refunds: CashFlowModel[] }) {
	return (
		<div className="overflow-x-auto">
			<table className="w-full text-sm">
				<thead>
					<tr>
						<th className="text-left py-2 px-2 font-medium">
							Refund ID
						</th>
						<th className="text-left py-2 px-2 font-medium">
							Net Amount
						</th>
						<th className="text-left py-2 px-2 font-medium">
							Reference
						</th>
						<th className="text-left py-2 px-2 font-medium">
							Date
						</th>
					</tr>
				</thead>
				<tbody>
					{refunds.map((r) => (
						<tr
							key={`refund-${r.id}`}
							className="border-t border-line hover:bg-surface-secondary/30"
						>
							<td className="py-2 px-3">#{r.id}</td>
							<td className="py-2 px-3">
								<DisplayAmount
									amount={r.netAmount}
									currencyCode={r.currency}
								/>
							</td>
							<td className="py-2 px-3">
								{r.external_reference || '-'}
							</td>
							<td className="py-2 px-3">
								{formatDate(r.created_at, 'date-time')}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function ViewCashFlowOperationalRecords({
	operationalRecords,
}: {
	operationalRecords: OperationalRecordModel[];
}) {
	return (
		<div className="overflow-x-auto">
			<table className="w-full text-sm">
				<thead>
					<tr>
						<th className="text-left py-2 px-2 font-medium">ID</th>
						<th className="text-left py-2 px-2 font-medium">
							Type
						</th>
						<th className="text-left py-2 px-2 font-medium">
							Reference
						</th>
						<th className="text-left py-2 px-2 font-medium">
							Date
						</th>
					</tr>
				</thead>
				<tbody>
					{operationalRecords.map((m) => (
						<tr
							key={`operational-record-${m.id}`}
							className="border-t border-line hover:bg-surface-secondary/30"
						>
							<td className="py-2 px-3">#{m.id}</td>
							<td className="py-2 px-3">
								{formatEnumLabel(m.operational_record_type)}
							</td>
							<td className="py-2 px-3">
								{(() => {
									switch (m.operational_record_type) {
										case 'client':
											return m.client
												? displayClientLabel(m.client)
												: '-';
										case 'vendor':
											return m.vendor
												? displayVendorLabel(m.vendor)
												: '-';
										case 'employee':
											return m.employee
												? displayUserLabel(m.employee)
												: '-';
										case 'company_vehicle':
											return m.company_vehicle
												? displayCompanyVehicleLabel(
														m.company_vehicle,
													)
												: '-';
										case 'cmr':
											return m.cmr
												? displayCmrLabel(m.cmr)
												: '-';
									}
								})()}
							</td>
							<td className="py-2 px-3">
								{formatDate(m.created_at, 'date-time')}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

export function ViewCashFlow({ entry }: { entry: CashFlowModel }) {
	const { data: refunds, isLoading: isRefundsLoading } = useQuery({
		queryKey: ['cash-flow', 'refunds', entry.id],
		queryFn: () => {
			if (
				entry.status !== CashFlowStatusEnum.COMPLETED ||
				entry.category === CashFlowCategoryEnum.REFUND
			) {
				return Promise.resolve(undefined);
			}

			return requestFind<CashFlowModel>('cash-flow', {
				filter: {
					parent_id: entry.id,
				},
			});
		},
		enabled:
			entry.status === CashFlowStatusEnum.COMPLETED &&
			entry.category !== CashFlowCategoryEnum.REFUND,
	});

	const { data: operationalRecords, isLoading: isOperationalRecordsLoading } =
		useQuery({
			queryKey: ['cash-flow', 'operational-records', entry.id],
			queryFn: () => {
				return requestOperationalRecords(entry.id);
			},
		});

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">ID</span> {entry.id}
				<div className="max-w-60 ml-2">
					<DisplayStatus
						status={entry.status}
						dataSource="cash-flow"
					/>
				</div>
			</div>

			<ViewSection title="Info">
				<ViewField
					label="Direction"
					value={formatEnumLabel(entry.direction)}
				/>
				<ViewField
					label="Type"
					value={formatEnumLabel(entry.category_type)}
				/>
				<ViewField
					label="Category"
					value={formatEnumLabel(entry.category)}
				/>
				<ViewField
					label="Net Amount"
					value={
						<DisplayAmount
							amount={entry.netAmount}
							currencyCode={entry.currency}
						/>
					}
				/>
				<ViewField
					label="Gross Amount"
					value={
						<DisplayAmount
							amount={entry.grossAmount}
							currencyCode={entry.currency}
						/>
					}
				/>
				{entry.currency !== Configuration.currency() && (
					<ViewField
						label="Exchange Rate"
						value={entry.exchange_rate}
					/>
				)}
				{entry.external_reference && (
					<ViewField
						label="Reference"
						value={entry.external_reference}
					/>
				)}
				{entry.notes && (
					<ViewField label="Notes" value={entry.notes} full />
				)}
			</ViewSection>

			<ViewSection title="Timestamps">
				<ViewField
					label="Created At"
					value={formatDate(entry.created_at, 'date-time')}
				/>
				<ViewField
					label="Updated At"
					value={formatDate(entry.updated_at, 'date-time')}
				/>
				{entry.deleted_at && (
					<ViewField
						label="Deleted At"
						value={
							<span className="text-danger">
								{formatDate(entry.deleted_at, 'date-time')}
							</span>
						}
					/>
				)}
			</ViewSection>

			{!isRefundsLoading && refunds && refunds.entries.length > 0 && (
				<div>
					<h3 className="font-bold border-b border-line pb-2 mb-3">
						Refunds
					</h3>
					<ViewCashFlowRefunds refunds={refunds.entries} />
				</div>
			)}

			{!isOperationalRecordsLoading &&
				operationalRecords &&
				operationalRecords.length > 0 && (
					<div>
						<h3 className="font-bold border-b border-line pb-2 mb-3">
							Operational Records
						</h3>
						<ViewCashFlowOperationalRecords
							operationalRecords={operationalRecords}
						/>
					</div>
				)}
		</div>
	);
}
