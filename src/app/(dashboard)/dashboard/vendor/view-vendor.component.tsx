'use client';

import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { formatDate } from '@/helpers/date.helper';
import { DisplayStatus } from '@/helpers/display.helper';
import {
	enumTranslationKeys,
	translateEnumLabel,
} from '@/helpers/string.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import { type VendorModel, VendorTypeEnum } from '@/models/vendor.model';

const TRANSLATION_KEYS = [
	'vendor.field.created_at',
	'vendor.field.deleted_at',
	'vendor.field.id',
	'vendor.field.name',
	'vendor.field.type',
	'vendor.field.updated_at',
	'vendor.section.info',
	'vendor.section.timestamps',
	...enumTranslationKeys('vendor.enum.type', VendorTypeEnum),
] as const;

export function ViewVendor({ entry }: { entry: VendorModel }) {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">
					{translations['vendor.field.id']}
				</span>{' '}
				{entry.id}
				<div className="max-w-60 ml-2">
					<DisplayStatus status={entry.status} dataSource="vendor" />
				</div>
			</div>

			<ViewSection title={translations['vendor.section.info']}>
				<ViewField
					label={translations['vendor.field.name']}
					value={entry.name}
				/>
				<ViewField
					label={translations['vendor.field.type']}
					value={translateEnumLabel(
						translations,
						'vendor.enum.type',
						entry.type,
					)}
				/>
			</ViewSection>

			<ViewSection title={translations['vendor.section.timestamps']}>
				<ViewField
					label={translations['vendor.field.created_at']}
					value={formatDate(entry.created_at, 'date-time')}
				/>
				<ViewField
					label={translations['vendor.field.updated_at']}
					value={formatDate(entry.updated_at, 'date-time')}
				/>
				{entry.deleted_at && (
					<ViewField
						label={translations['vendor.field.deleted_at']}
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
