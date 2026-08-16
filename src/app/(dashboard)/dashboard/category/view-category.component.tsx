'use client';

import { useState } from 'react';
import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { ViewLanguageSwitcher } from '@/app/(dashboard)/_components/view-language-switcher';
import { getLanguageClient } from '@/config/translate.setup';
import { formatDate } from '@/helpers/date.helper';
import { DisplayStatus } from '@/helpers/display.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import {
	type CategoryModel,
	getCategoryContentProp,
} from '@/models/category.model';

export function ViewCategory({ entry }: { entry: CategoryModel }) {
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
					<DisplayStatus
						status={entry.status}
						dataSource="category"
					/>
				</div>
			</div>

			<ViewSection title="Info">
				<ViewField label="Type" value={formatEnumLabel(entry.type)} />
				<ViewField
					label="Parent"
					value={
						entry.parent
							? getCategoryContentProp(
									entry.parent,
									getLanguageClient(),
									'label',
								)
							: '-'
					}
				/>
				<ViewField
					label="Sort Order"
					value={String(entry.sort_order ?? 0)}
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
					<ViewLanguageSwitcher
						label="Language specific"
						languages={languages}
						selected={content.language}
						onSelect={setLanguage}
					/>

					<ViewSection>
						<ViewField label="Label" value={content.label} />
						<ViewField label="Slug" value={content.slug} />
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
