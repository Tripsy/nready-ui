'use client';

import { useState } from 'react';
import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { ManagerLanguageSwitcher } from '@/components/manager-language-switcher.component';
import { formatDate } from '@/helpers/date.helper';
import { DisplayStatus, displayImage } from '@/helpers/display.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import { type ImageModel, showImage } from '@/models/image.model';

export function ViewImage({ entry }: { entry: ImageModel }) {
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
					<DisplayStatus status={entry.status} dataSource="image" />
				</div>
			</div>

			<ViewSection title="Info">
				<ViewField
					label="Section"
					value={formatEnumLabel(entry.section)}
				/>
				<ViewField
					label="Type"
					value={formatEnumLabel(entry.image_type)}
				/>
				<ViewField
					label="Image"
					value={displayImage({
						src: showImage(entry.path, entry.storage),
						alt: entry.path,
						width: 100,
						height: 100,
					})}
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
						<ViewField label="Title" value={content.title} />
						<ViewField
							label="Description"
							value={content.description}
						/>
					</ViewSection>
				</div>
			)}
		</div>
	);
}
