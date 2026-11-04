'use client';

import { useQuery } from '@tanstack/react-query';
import {
	ViewField,
	ViewRow,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { Configuration } from '@/config/settings.config';
import { formatDate } from '@/helpers/date.helper';
import { DisplayAmount, DisplayStatus } from '@/helpers/display.helper';
import { requestFind } from '@/helpers/services.helper';
import {
	enumTranslationKeys,
	translateEnumLabel,
} from '@/helpers/string.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import {
	CashFlowCategoryEnum,
	CashFlowCategoryTypeEnum,
	CashFlowDirectionEnum,
	type CashFlowModel,
	CashFlowStatusEnum,
	OperationalRecordTypeEnum,
} from '@/models/cash-flow.model';
import { displayClientLabel } from '@/models/client.model';
import type { OperationalRecordModel } from '@/models/operational-record.model';
import { displayOrderReference } from '@/models/order.model';
import { displayVendorLabel } from '@/models/vendor.model';
import { requestOperationalRecords } from '@/services/cash-flow.service';

const TRANSLATION_KEYS = [
	'cash-flow.field.category',
	'cash-flow.field.category_type',
	'cash-flow.field.created_at',
	'cash-flow.field.date',
	'cash-flow.field.deleted_at',
	'cash-flow.field.direction',
	'cash-flow.field.exchange_rate',
	'cash-flow.field.external_reference',
	'cash-flow.field.gross_amount',
	'cash-flow.field.id',
	'cash-flow.field.net_amount',
	'cash-flow.field.notes',
	'cash-flow.field.reference',
	'cash-flow.field.refund_id',
	'cash-flow.field.type',
	'cash-flow.field.updated_at',
	'cash-flow.section.info',
	'cash-flow.section.operational_records',
	'cash-flow.section.refunds',
	'cash-flow.section.timestamps',
	...enumTranslationKeys(
		'cash-flow.enum.category_type',
		CashFlowCategoryTypeEnum,
	),
	...enumTranslationKeys('cash-flow.enum.category', CashFlowCategoryEnum),
	...enumTranslationKeys('cash-flow.enum.direction', CashFlowDirectionEnum),
	...enumTranslationKeys(
		'cash-flow.enum.operational_record_type',
		OperationalRecordTypeEnum,
	),
] as const;

type TranslationsType = Record<(typeof TRANSLATION_KEYS)[number], string>;

function ViewCashFlowRefunds({
	translations,
	refunds,
}: {
	translations: TranslationsType;
	refunds: CashFlowModel[];
}) {
	return (
		<div className="overflow-x-auto">
			<table className="w-full text-sm">
				<thead>
					<tr>
						<th className="text-left py-2 px-2 font-medium">
							{translations['cash-flow.field.refund_id']}
						</th>
						<th className="text-left py-2 px-2 font-medium">
							{translations['cash-flow.field.net_amount']}
						</th>
						<th className="text-left py-2 px-2 font-medium">
							{translations['cash-flow.field.reference']}
						</th>
						<th className="text-left py-2 px-2 font-medium">
							{translations['cash-flow.field.date']}
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
									amount={r.net_amount}
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
	translations,
	operationalRecords,
}: {
	translations: TranslationsType;
	operationalRecords: OperationalRecordModel[];
}) {
	return (
		<div className="overflow-x-auto">
			<table className="w-full text-sm">
				<thead>
					<tr>
						<th className="text-left py-2 px-2 font-medium">
							{translations['cash-flow.field.id']}
						</th>
						<th className="text-left py-2 px-2 font-medium">
							{translations['cash-flow.field.type']}
						</th>
						<th className="text-left py-2 px-2 font-medium">
							{translations['cash-flow.field.reference']}
						</th>
						<th className="text-left py-2 px-2 font-medium">
							{translations['cash-flow.field.date']}
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
								{translateEnumLabel(
									translations,
									'cash-flow.enum.operational_record_type',
									m.operational_record_type,
								)}
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
										case 'order':
											return m.order
												? displayOrderReference(m.order)
												: `#${m.entity_id}`;
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
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const { data: refunds, isLoading: isRefundsLoading } = useQuery({
		queryKey: ['cash-flow', 'refunds', entry.id],
		queryFn: async () => {
			const response = await requestFind<CashFlowModel>('cash-flow', {
				filter: {
					parent_id: entry.id,
				},
			});

			// `requestFind` resolves to `undefined` when the response carries no payload, and
			// TanStack Query rejects that as query data - the same failure the guard below
			// exists to avoid. Throwing puts it in `isError`, where a caller can see it.
			if (!response) {
				throw new Error('Could not retrieve refunds');
			}

			return response;
		},
		// The queryFn does not repeat this test: `enabled` already keeps it from running, and
		// a branch returning `undefined` to satisfy the type is exactly what breaks the query.
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
				<span className="font-semibold">
					{translations['cash-flow.field.id']}
				</span>{' '}
				{entry.id}
				<div className="max-w-60 ml-2">
					<DisplayStatus
						status={entry.status}
						dataSource="cash-flow"
					/>
				</div>
			</div>

			<ViewSection
				title={translations['cash-flow.section.info']}
				layout="rows"
			>
				<ViewRow>
					<ViewField
						label={translations['cash-flow.field.direction']}
						value={translateEnumLabel(
							translations,
							'cash-flow.enum.direction',
							entry.direction,
						)}
					/>
					<ViewField
						label={translations['cash-flow.field.category_type']}
						value={translateEnumLabel(
							translations,
							'cash-flow.enum.category_type',
							entry.category_type,
						)}
					/>
					<ViewField
						label={translations['cash-flow.field.category']}
						value={translateEnumLabel(
							translations,
							'cash-flow.enum.category',
							entry.category,
						)}
					/>
				</ViewRow>

				<ViewRow>
					<ViewField
						label={translations['cash-flow.field.net_amount']}
						value={
							<DisplayAmount
								amount={entry.net_amount}
								currencyCode={entry.currency}
							/>
						}
					/>
					<ViewField
						label={translations['cash-flow.field.gross_amount']}
						value={
							<DisplayAmount
								amount={entry.gross_amount}
								currencyCode={entry.currency}
							/>
						}
					/>
					{entry.currency !== Configuration.currency() && (
						<ViewField
							label={
								translations['cash-flow.field.exchange_rate']
							}
							value={entry.exchange_rate}
						/>
					)}
				</ViewRow>

				{entry.external_reference && (
					<ViewRow>
						<ViewField
							label={
								translations[
									'cash-flow.field.external_reference'
								]
							}
							value={entry.external_reference}
						/>
					</ViewRow>
				)}

				{entry.notes && (
					<ViewRow>
						<ViewField
							label={translations['cash-flow.field.notes']}
							value={entry.notes}
							full
						/>
					</ViewRow>
				)}
			</ViewSection>

			<ViewSection title={translations['cash-flow.section.timestamps']}>
				<ViewField
					label={translations['cash-flow.field.created_at']}
					value={formatDate(entry.created_at, 'date-time')}
				/>
				<ViewField
					label={translations['cash-flow.field.updated_at']}
					value={formatDate(entry.updated_at, 'date-time')}
				/>
				{entry.deleted_at && (
					<ViewField
						label={translations['cash-flow.field.deleted_at']}
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
						{translations['cash-flow.section.refunds']}
					</h3>
					<ViewCashFlowRefunds
						translations={translations}
						refunds={refunds.entries}
					/>
				</div>
			)}

			{!isOperationalRecordsLoading &&
				operationalRecords &&
				operationalRecords.length > 0 && (
					<div>
						<h3 className="font-bold border-b border-line pb-2 mb-3">
							{
								translations[
									'cash-flow.section.operational_records'
								]
							}
						</h3>
						<ViewCashFlowOperationalRecords
							translations={translations}
							operationalRecords={operationalRecords}
						/>
					</div>
				)}
		</div>
	);
}
