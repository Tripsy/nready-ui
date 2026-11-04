'use client';

import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { formatDate } from '@/helpers/date.helper';
import { parseJson } from '@/helpers/string.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import type { TemplateModel } from '@/models/template.model';

const TRANSLATION_KEYS = [
	'template.field.created_at',
	'template.field.deleted_at',
	'template.field.id',
	'template.field.label',
	'template.field.language',
	'template.field.type',
	'template.field.updated_at',
	'template.section.content',
	'template.section.info',
	'template.section.timestamps',
] as const;

export function ViewTemplate({ entry }: { entry: TemplateModel }) {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const parsedContent = parseJson(entry.content);

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">
					{translations['template.field.id']}
				</span>{' '}
				{entry.id}
			</div>

			<ViewSection title={translations['template.section.info']}>
				<ViewField
					label={translations['template.field.label']}
					value={entry.label}
				/>
				<ViewField
					label={translations['template.field.language']}
					value={entry.language}
				/>
				<ViewField
					label={translations['template.field.type']}
					value={entry.type}
				/>
			</ViewSection>

			<ViewSection title={translations['template.section.timestamps']}>
				<ViewField
					label={translations['template.field.created_at']}
					value={formatDate(entry.created_at, 'date-time')}
				/>
				<ViewField
					label={translations['template.field.updated_at']}
					value={formatDate(entry.updated_at, 'date-time')}
				/>
				{entry.deleted_at && (
					<ViewField
						label={translations['template.field.deleted_at']}
						value={
							<span className="text-danger">
								{formatDate(entry.deleted_at, 'date-time')}
							</span>
						}
					/>
				)}
			</ViewSection>

			{parsedContent && (
				<ViewSection title={translations['template.section.content']}>
					{Object.entries(parsedContent).map(([key, value]) => (
						<ViewField
							key={key}
							label={key}
							value={
								typeof value === 'object'
									? JSON.stringify(value, null, 2)
									: String(value)
							}
							full
						/>
					))}
				</ViewSection>
			)}
		</div>
	);
}
