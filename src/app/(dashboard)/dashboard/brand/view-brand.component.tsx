'use client';

import { useState } from 'react';
import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { ManagerLanguageSwitcher } from '@/components/manager-language-switcher.component';
import { formatDate } from '@/helpers/date.helper';
import { DisplayStatus } from '@/helpers/display.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import type { BrandModel } from '@/models/brand.model';

export function ViewBrand({ entry }: { entry: BrandModel }) {
	const languageContents = Object.values(entry.contents ?? []);
	const languages = languageContents.map((value) => value.language);
	const [language, setLanguage] = useState(languages[0]);

	const content =
		languageContents.find((value) => value.language === language) ??
		languageContents[0];

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">ID</span> {entry.id}
				<div className="max-w-60 ml-2">
					<DisplayStatus status={entry.status} dataSource="brand" />
				</div>
			</div>

			<ViewSection title="Info">
				<ViewField
					label="Type"
					value={formatEnumLabel(entry.brand_type)}
				/>
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

			{content && (
				<div>
					<ManagerLanguageSwitcher
						label="Language specific"
						languages={languages}
						selected={content.language}
						onSelect={setLanguage}
					/>

					<ViewSection>
						<ViewField
							label="Description"
							value={content.description}
						/>
						<ViewField
							label="Meta - Title"
							value={content.meta?.title}
						/>
						<ViewField
							label="Meta - Description"
							value={content.meta?.description}
						/>
						<ViewField
							label="Meta - Keywords"
							value={content.meta?.keywords}
						/>
					</ViewSection>
				</div>
			)}
		</div>
	);
}
