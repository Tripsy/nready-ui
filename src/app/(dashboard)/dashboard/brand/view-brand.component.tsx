'use client';

import { useState } from 'react';
import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { ManagerLanguageSwitcher } from '@/components/manager-language-switcher.component';
import { formatDate } from '@/helpers/date.helper';
import { DisplayStatus } from '@/helpers/display.helper';
import {
	enumTranslationKeys,
	translateEnumLabel,
} from '@/helpers/string.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import { type BrandModel, BrandTypeEnum } from '@/models/brand.model';

const TRANSLATION_KEYS = [
	'brand.field.brand_type',
	'brand.field.created_at',
	'brand.field.deleted_at',
	'brand.field.description',
	'brand.field.id',
	'brand.field.meta_description',
	'brand.field.meta_keywords',
	'brand.field.meta_title',
	'brand.field.updated_at',
	'brand.section.info',
	'brand.section.timestamps',
	'brand.text.language_specific',
	...enumTranslationKeys('brand.enum.type', BrandTypeEnum),
] as const;

export function ViewBrand({ entry }: { entry: BrandModel }) {
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
					{translations['brand.field.id']}
				</span>{' '}
				{entry.id}
				<div className="max-w-60 ml-2">
					<DisplayStatus status={entry.status} dataSource="brand" />
				</div>
			</div>

			<ViewSection title={translations['brand.section.info']}>
				<ViewField
					label={translations['brand.field.brand_type']}
					value={translateEnumLabel(
						translations,
						'brand.enum.type',
						entry.brand_type,
					)}
				/>
			</ViewSection>

			<ViewSection title={translations['brand.section.timestamps']}>
				<ViewField
					label={translations['brand.field.created_at']}
					value={formatDate(entry.created_at, 'date-time')}
				/>
				<ViewField
					label={translations['brand.field.updated_at']}
					value={formatDate(entry.updated_at, 'date-time')}
				/>
				{entry.deleted_at && (
					<ViewField
						label={translations['brand.field.deleted_at']}
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
						label={translations['brand.text.language_specific']}
						languages={languages}
						selected={content.language}
						onSelect={setLanguage}
					/>

					<ViewSection>
						<ViewField
							label={translations['brand.field.description']}
							value={content.description}
						/>
						<ViewField
							label={translations['brand.field.meta_title']}
							value={content.meta?.title}
						/>
						<ViewField
							label={translations['brand.field.meta_description']}
							value={content.meta?.description}
						/>
						<ViewField
							label={translations['brand.field.meta_keywords']}
							value={content.meta?.keywords}
						/>
					</ViewSection>
				</div>
			)}
		</div>
	);
}
