'use client';

import { useState } from 'react';
import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { ManagerLanguageSwitcher } from '@/components/manager-language-switcher.component';
import { getLanguageClient } from '@/config/translate.setup';
import { formatDate } from '@/helpers/date.helper';
import { DisplayStatus } from '@/helpers/display.helper';
import {
	enumTranslationKeys,
	translateEnumLabel,
} from '@/helpers/string.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import {
	type CategoryModel,
	CategoryTypeEnum,
	getCategoryContentProp,
} from '@/models/category.model';

const TRANSLATION_KEYS = [
	'category.field.created_at',
	'category.field.deleted_at',
	'category.field.description',
	'category.field.id',
	'category.field.label',
	'category.field.meta_description',
	'category.field.meta_keywords',
	'category.field.meta_title',
	'category.field.parent',
	'category.field.slug',
	'category.field.sort_order',
	'category.field.type',
	'category.field.updated_at',
	'category.section.info',
	'category.section.timestamps',
	'category.text.language_specific',
	...enumTranslationKeys('category.enum.type', CategoryTypeEnum),
] as const;

export function ViewCategory({ entry }: { entry: CategoryModel }) {
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
					{translations['category.field.id']}
				</span>{' '}
				{entry.id}
				<div className="max-w-60 ml-2">
					<DisplayStatus
						status={entry.status}
						dataSource="category"
					/>
				</div>
			</div>

			<ViewSection title={translations['category.section.info']}>
				<ViewField
					label={translations['category.field.type']}
					value={translateEnumLabel(
						translations,
						'category.enum.type',
						entry.type,
					)}
				/>
				<ViewField
					label={translations['category.field.parent']}
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
					label={translations['category.field.sort_order']}
					value={String(entry.sort_order ?? 0)}
				/>
			</ViewSection>

			<ViewSection title={translations['category.section.timestamps']}>
				<ViewField
					label={translations['category.field.created_at']}
					value={formatDate(entry.created_at, 'date-time')}
				/>
				<ViewField
					label={translations['category.field.updated_at']}
					value={formatDate(entry.updated_at, 'date-time')}
				/>
				{entry.deleted_at && (
					<ViewField
						label={translations['category.field.deleted_at']}
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
						label={translations['category.text.language_specific']}
						languages={languages}
						selected={content.language}
						onSelect={setLanguage}
					/>

					<ViewSection>
						<ViewField
							label={translations['category.field.label']}
							value={content.label}
						/>
						<ViewField
							label={translations['category.field.slug']}
							value={content.slug}
						/>
						<ViewField
							label={translations['category.field.description']}
							value={content.description}
						/>
						<ViewField
							label={translations['category.field.meta_title']}
							value={content.meta?.title}
						/>
						<ViewField
							label={
								translations['category.field.meta_description']
							}
							value={content.meta?.description}
						/>
						<ViewField
							label={translations['category.field.meta_keywords']}
							value={content.meta?.keywords}
						/>
					</ViewSection>
				</div>
			)}
		</div>
	);
}
