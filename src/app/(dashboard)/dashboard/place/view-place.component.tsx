'use client';

import { useState } from 'react';
import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { ManagerLanguageSwitcher } from '@/components/manager-language-switcher.component';
import { formatDate } from '@/helpers/date.helper';
import {
	capitalizeFirstLetter,
	enumTranslationKeys,
	translateEnumLabel,
} from '@/helpers/string.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import { type PlaceModel, PlaceTypeEnum } from '@/models/place.model';

const TRANSLATION_KEYS = [
	'place.field.code',
	'place.field.created_at',
	'place.field.deleted_at',
	'place.field.id',
	'place.field.name',
	'place.field.place_type',
	'place.field.type_label',
	'place.field.updated_at',
	'place.section.info',
	'place.section.timestamps',
	'place.text.language_specific',
	...enumTranslationKeys('place.enum.type', PlaceTypeEnum),
] as const;

export function ViewPlace({ entry }: { entry: PlaceModel }) {
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
					{translations['place.field.id']}
				</span>{' '}
				{entry.id}
			</div>

			<ViewSection title={translations['place.section.info']}>
				<ViewField
					label={translations['place.field.place_type']}
					value={translateEnumLabel(
						translations,
						'place.enum.type',
						entry.place_type,
					)}
				/>
				<ViewField
					label={translations['place.field.code']}
					value={entry.code}
				/>
			</ViewSection>

			<ViewSection title={translations['place.section.timestamps']}>
				<ViewField
					label={translations['place.field.created_at']}
					value={formatDate(entry.created_at, 'date-time')}
				/>
				<ViewField
					label={translations['place.field.updated_at']}
					value={formatDate(entry.updated_at, 'date-time')}
				/>
				{entry.deleted_at && (
					<ViewField
						label={translations['place.field.deleted_at']}
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
						label={translations['place.text.language_specific']}
						languages={languages}
						selected={content.language}
						onSelect={setLanguage}
					/>

					<ViewSection>
						<ViewField
							label={translations['place.field.type_label']}
							value={capitalizeFirstLetter(content.type_label)}
						/>
						<ViewField
							label={translations['place.field.name']}
							value={content.name}
						/>
					</ViewSection>
				</div>
			)}
		</div>
	);
}
