'use client';

import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { formatDate } from '@/helpers/date.helper';
import { DisplayStatus } from '@/helpers/display.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import type { WarehouseModel } from '@/models/warehouse.model';

const TRANSLATION_KEYS = [
	'warehouse.field.code',
	'warehouse.field.created_at',
	'warehouse.field.deleted_at',
	'warehouse.field.details',
	'warehouse.field.id',
	'warehouse.field.is_default',
	'warehouse.field.name',
	'warehouse.field.notes',
	'warehouse.field.postal_code',
	'warehouse.field.updated_at',
	'warehouse.section.address',
	'warehouse.section.info',
	'warehouse.section.notes',
	'warehouse.section.timestamps',
	'dashboard.text.yes',
	'dashboard.text.no',
] as const;

export function ViewWarehouse({ entry }: { entry: WarehouseModel }) {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">
					{translations['warehouse.field.id']}
				</span>{' '}
				{entry.id}
				<div className="max-w-60 ml-2">
					<DisplayStatus
						status={entry.status}
						dataSource="warehouse"
					/>
				</div>
			</div>

			<ViewSection title={translations['warehouse.section.info']}>
				<ViewField
					label={translations['warehouse.field.code']}
					value={entry.code}
				/>
				<ViewField
					label={translations['warehouse.field.name']}
					value={entry.name}
				/>
				<ViewField
					label={translations['warehouse.field.is_default']}
					value={
						entry.is_default
							? translations['dashboard.text.yes']
							: translations['dashboard.text.no']
					}
				/>
			</ViewSection>

			<ViewSection title={translations['warehouse.section.address']}>
				{/*
				 * The joined address is the narrow select the backend sends with a warehouse -
				 * it carries no city row, so the street line is the whole label available here.
				 */}
				<ViewField
					label={translations['warehouse.field.details']}
					value={entry.address?.details ?? '-'}
				/>
				<ViewField
					label={translations['warehouse.field.postal_code']}
					value={entry.address?.postal_code ?? '-'}
				/>
			</ViewSection>

			{entry.notes && (
				<ViewSection title={translations['warehouse.section.notes']}>
					<ViewField
						label={translations['warehouse.field.notes']}
						value={entry.notes}
					/>
				</ViewSection>
			)}

			<ViewSection title={translations['warehouse.section.timestamps']}>
				<ViewField
					label={translations['warehouse.field.created_at']}
					value={formatDate(entry.created_at, 'date-time')}
				/>
				<ViewField
					label={translations['warehouse.field.updated_at']}
					value={formatDate(entry.updated_at, 'date-time')}
				/>
				{entry.deleted_at && (
					<ViewField
						label={translations['warehouse.field.deleted_at']}
						value={
							<span className="text-danger">
								{formatDate(entry.deleted_at, 'date-time')}
							</span>
						}
					/>
				)}
			</ViewSection>
		</div>
	);
}
