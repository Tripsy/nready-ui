import { translateBatch } from '@/config/translate.setup';
import type { CmrSessionModel } from '@/models/cmr-session.model';
import { deleteCmrSession } from '@/services/cmr-session.service';
import type { DataSourceConfigType } from '@/types/data-source.type';

export default async function dataSourceConfig(): Promise<
	DataSourceConfigType<CmrSessionModel>
> {
	const translations = await translateBatch(
		['drop.title'] as const,
		'cmr-session.action',
	);

	return {
		displayEntryLabel: (entry: CmrSessionModel) => {
			return `CMR${entry.cmr.id}`;
		},
		actions: {
			drop: {
				windowType: 'action',
				windowTitle: translations['drop.title'],
				permission: ['cmr-session', 'delete'],
				entriesSelection: 'single',
				operationFunction: (entry: CmrSessionModel) =>
					deleteCmrSession(entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
		},
	};
}
