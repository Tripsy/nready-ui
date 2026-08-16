'use client';

import { useState } from 'react';
import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { LanguageSwitcher } from '@/components/language-switcher.component';
import { formatDate } from '@/helpers/date.helper';
import {
	capitalizeFirstLetter,
	formatEnumLabel,
} from '@/helpers/string.helper';
import type { PlaceModel } from '@/models/place.model';

export function ViewPlace({ entry }: { entry: PlaceModel }) {
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
			</div>

			<ViewSection title="Info">
				<ViewField
					label="Type"
					value={formatEnumLabel(entry.place_type)}
				/>
				<ViewField label="Code" value={entry.code} />
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
					<LanguageSwitcher
						label="Language specific"
						languages={languages}
						selected={content.language}
						onSelect={setLanguage}
					/>

					<ViewSection>
						<ViewField
							label="Type - Label"
							value={capitalizeFirstLetter(content.type_label)}
						/>
						<ViewField label="Name" value={content.name} />
					</ViewSection>
				</div>
			)}
		</div>
	);
}
