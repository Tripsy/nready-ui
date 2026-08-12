'use client';

import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { formatDate } from '@/helpers/date.helper';
import { parseJson } from '@/helpers/string.helper';
import type { TemplateModel } from '@/models/template.model';

export function ViewTemplate({ entry }: { entry: TemplateModel }) {
	const parsedContent = parseJson(entry.content);

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">ID</span> {entry.id}
			</div>

			<ViewSection title="Info">
				<ViewField label="Label" value={entry.label} />
				<ViewField label="Language" value={entry.language} />
				<ViewField label="Type" value={entry.type} />
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

			{parsedContent && (
				<ViewSection title="Content">
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
