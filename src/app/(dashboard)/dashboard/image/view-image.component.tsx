'use client';

import { useState } from 'react';
import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { ManagerLanguageSwitcher } from '@/components/manager-language-switcher.component';
import { formatDate } from '@/helpers/date.helper';
import { DisplayStatus, displayImage } from '@/helpers/display.helper';
import {
	enumTranslationKeys,
	translateEnumLabel,
} from '@/helpers/string.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import {
	type ImageModel,
	ImageSectionEnum,
	ImageTypeEnum,
	showImage,
} from '@/models/image.model';

const TRANSLATION_KEYS = [
	'image.field.created_at',
	'image.field.description',
	'image.field.id',
	'image.field.image_type',
	'image.field.image',
	'image.field.section',
	'image.field.title',
	'image.field.updated_at',
	'image.section.info',
	'image.section.timestamps',
	'image.text.language_specific',
	...enumTranslationKeys('image.enum.section', ImageSectionEnum),
	...enumTranslationKeys('image.enum.type', ImageTypeEnum),
] as const;

export function ViewImage({ entry }: { entry: ImageModel }) {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const languageContents = Object.values(entry.contents ?? []);
	const languages = languageContents.map((value) => value.language);
	const [language, setLanguage] = useState(languages[0]);

	const content =
		languageContents.find((value) => value.language === language) ??
		languageContents[0];

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">
					{translations['image.field.id']}
				</span>{' '}
				{entry.id}
				<div className="max-w-60 ml-2">
					<DisplayStatus status={entry.status} dataSource="image" />
				</div>
			</div>

			<ViewSection title={translations['image.section.info']}>
				<ViewField
					label={translations['image.field.section']}
					value={translateEnumLabel(
						translations,
						'image.enum.section',
						entry.section,
					)}
				/>
				<ViewField
					label={translations['image.field.image_type']}
					value={translateEnumLabel(
						translations,
						'image.enum.type',
						entry.image_type,
					)}
				/>
				<ViewField
					label={translations['image.field.image']}
					value={displayImage({
						src: showImage(entry.path, entry.storage),
						alt: entry.path,
						width: 100,
						height: 100,
					})}
				/>
			</ViewSection>

			<ViewSection title={translations['image.section.timestamps']}>
				<ViewField
					label={translations['image.field.created_at']}
					value={formatDate(entry.created_at, 'date-time')}
				/>
				<ViewField
					label={translations['image.field.updated_at']}
					value={formatDate(entry.updated_at, 'date-time')}
				/>
			</ViewSection>

			{content && (
				<div>
					<ManagerLanguageSwitcher
						label={translations['image.text.language_specific']}
						languages={languages}
						selected={content.language}
						onSelect={setLanguage}
					/>

					<ViewSection>
						<ViewField
							label={translations['image.field.title']}
							value={content.title}
						/>
						<ViewField
							label={translations['image.field.description']}
							value={content.description}
						/>
					</ViewSection>
				</div>
			)}
		</div>
	);
}
