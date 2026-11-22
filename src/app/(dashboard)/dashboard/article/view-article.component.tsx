'use client';

import { useState } from 'react';
import {
	ViewField,
	ViewRow,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { ManagerLanguageSwitcher } from '@/components/manager-language-switcher.component';
import { getLanguageClient } from '@/config/translate.setup';
import { formatDate } from '@/helpers/date.helper';
import { DisplayStatus } from '@/helpers/display.helper';
import { renderMarkdown } from '@/helpers/markdown.helper';
import {
	enumTranslationKeys,
	translateEnumLabel,
} from '@/helpers/string.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import {
	ArticleFeaturedStatusEnum,
	ArticleLayoutEnum,
	type ArticleModel,
	ArticleSourceModeEnum,
	ArticleVisibilityEnum,
	getArticleLinkLabels,
} from '@/models/article.model';

const TRANSLATION_KEYS = [
	'article.field.about',
	'article.field.allow_comments',
	'article.field.allow_complaints',
	'article.field.allow_rating',
	'article.field.archive_at',
	'article.field.brief',
	'article.field.categories',
	'article.field.created_at',
	'article.field.deleted_at',
	'article.field.source_disclaimer',
	'article.field.featured_expire_at',
	'article.field.featured_status',
	'article.field.id',
	'article.field.rule_allowed_countries',
	'article.field.label',
	'article.field.layout',
	'article.field.meta_description',
	'article.field.meta_keywords',
	'article.field.meta_title',
	'article.field.name',
	'article.field.public_at',
	'article.field.publish_at',
	'article.field.rule_requires_auth',
	'article.field.rule_requires_subscription',
	'article.field.slug',
	'article.field.source_mode',
	'article.field.tag_id',
	'article.field.title',
	'article.field.updated_at',
	'article.field.url',
	'article.field.visibility',
	'article.section.attribution',
	'article.section.content',
	'article.section.featured',
	'article.section.info',
	'article.section.reader_participation',
	'article.section.seo',
	'article.section.source',
	'article.section.timestamps',
	'article.section.visibility',
	'article.field.featured_order',
	'dashboard.text.yes',
	'dashboard.text.no',
	...enumTranslationKeys('article.enum.layout', ArticleLayoutEnum),
	...enumTranslationKeys('article.enum.source_mode', ArticleSourceModeEnum),
	...enumTranslationKeys('article.enum.visibility', ArticleVisibilityEnum),
	...enumTranslationKeys(
		'article.enum.featured_status',
		ArticleFeaturedStatusEnum,
	),
] as const;

export function ViewArticle({ entry }: { entry: ArticleModel }) {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const languageContents = entry.contents ?? [];
	const languages = languageContents.map((content) => content.language);
	const [language, setLanguage] = useState(languages[0]);

	const content =
		languageContents.find((value) => value.language === language) ??
		languageContents[0];

	/*
	 * Link wording follows the switcher, because these read inside the content block. A link
	 * with no translation in the selected language falls back rather than vanishing, so the
	 * list still names every link the article carries.
	 */
	const linkLabels = getArticleLinkLabels(
		entry,
		content?.language ?? getLanguageClient(),
	);

	const categoryLabels = Object.values(linkLabels.categories).join(', ');
	const tagLabels = Object.values(linkLabels.tags).join(', ');

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">
					{translations['article.field.id']}
				</span>{' '}
				{entry.id}
				<div className="max-w-60 ml-2">
					<DisplayStatus status={entry.status} dataSource="article" />
				</div>
			</div>

			{content && (
				<>
					<ManagerLanguageSwitcher
						languages={languages}
						selected={content.language}
						onSelect={setLanguage}
					/>

					<ViewSection
						title={translations['article.section.info']}
						layout="rows"
					>
						<ViewRow>
							<ViewField
								label={translations['article.field.layout']}
								value={
									entry.layout
										? translateEnumLabel(
												translations,
												'article.enum.layout',
												entry.layout,
											)
										: null
								}
							/>
							<ViewField
								label={translations['article.field.title']}
								value={content.title}
							/>
						</ViewRow>

						<ViewRow>
							<ViewField
								label={translations['article.field.brief']}
								value={content.brief}
								full
							/>
						</ViewRow>

						<ViewRow>
							<ViewField
								label={translations['article.field.categories']}
								value={categoryLabels}
								full
							/>
						</ViewRow>

						<ViewRow>
							<ViewField
								label={translations['article.field.tag_id']}
								value={tagLabels}
								full
							/>
						</ViewRow>
					</ViewSection>

					<ViewSection
						title={translations['article.section.content']}
						layout="rows"
					>
						{/*
						 * The stored value is markdown; this is the only place the dashboard
						 * turns it into HTML. `renderMarkdown` sanitizes, which is what makes
						 * the injection safe.
						 */}
						<div
							className="markdown-body"
							// biome-ignore lint/security/noDangerouslySetInnerHtml: markdown rendered and sanitized by `renderMarkdown`
							dangerouslySetInnerHTML={{
								__html: renderMarkdown(content.content),
							}}
						/>
					</ViewSection>

					<ViewSection
						title={translations['article.section.seo']}
						layout="rows"
					>
						<ViewField
							label={translations['article.field.slug']}
							value={content.slug}
						/>
						<ViewField
							label={translations['article.field.meta_title']}
							value={content.meta?.title}
						/>
						<ViewField
							label={
								translations['article.field.meta_description']
							}
							value={content.meta?.description}
						/>
						<ViewField
							label={translations['article.field.meta_keywords']}
							value={content.meta?.keywords}
						/>
					</ViewSection>
				</>
			)}

			<ViewSection title={translations['article.section.attribution']}>
				<ViewField
					label={translations['article.field.source_mode']}
					value={translateEnumLabel(
						translations,
						'article.enum.source_mode',
						entry.source_mode,
					)}
				/>
				<ViewField
					label={translations['article.field.name']}
					value={entry.author?.name}
				/>
			</ViewSection>

			{entry.source && (
				<ViewSection title={translations['article.section.source']}>
					<ViewField
						label={translations['article.field.label']}
						value={entry.source.label}
					/>
					<ViewField
						label={translations['article.field.url']}
						value={entry.source.url}
					/>
					<ViewField
						label={translations['article.field.source_disclaimer']}
						value={entry.source.disclaimer}
					/>
					<ViewField
						label={translations['article.field.about']}
						value={entry.source.about}
					/>
				</ViewSection>
			)}

			<ViewSection title={translations['article.section.visibility']}>
				<ViewField
					label={translations['article.field.visibility']}
					value={translateEnumLabel(
						translations,
						'article.enum.visibility',
						entry.visibility,
					)}
				/>
				<ViewField
					label={translations['article.field.public_at']}
					value={
						entry.public_at
							? formatDate(entry.public_at, 'date-time')
							: null
					}
				/>
				{entry.visibility_rule && (
					<>
						<ViewField
							label={
								translations['article.field.rule_requires_auth']
							}
							value={
								entry.visibility_rule.requires_auth
									? translations['dashboard.text.yes']
									: translations['dashboard.text.no']
							}
						/>
						<ViewField
							label={
								translations[
									'article.field.rule_requires_subscription'
								]
							}
							value={
								entry.visibility_rule.requires_subscription
									? translations['dashboard.text.yes']
									: translations['dashboard.text.no']
							}
						/>
						<ViewField
							label={
								translations[
									'article.field.rule_allowed_countries'
								]
							}
							value={
								entry.visibility_rule.allowed_countries?.join(
									', ',
								) ?? null
							}
						/>
					</>
				)}
			</ViewSection>

			{entry.settings && (
				<ViewSection
					title={translations['article.section.reader_participation']}
				>
					<ViewField
						label={translations['article.field.allow_rating']}
						value={
							entry.settings.allow_rating
								? translations['dashboard.text.yes']
								: translations['dashboard.text.no']
						}
					/>
					<ViewField
						label={translations['article.field.allow_comments']}
						value={
							entry.settings.allow_comments
								? translations['dashboard.text.yes']
								: translations['dashboard.text.no']
						}
					/>
					<ViewField
						label={translations['article.field.allow_complaints']}
						value={
							entry.settings.allow_complaints
								? translations['dashboard.text.yes']
								: translations['dashboard.text.no']
						}
					/>
				</ViewSection>
			)}

			<ViewSection title={translations['article.section.featured']}>
				<ViewField
					label={translations['article.field.featured_status']}
					value={
						entry.featured_status
							? translateEnumLabel(
									translations,
									'article.enum.featured_status',
									entry.featured_status,
								)
							: null
					}
				/>
				<ViewField
					label={translations['article.field.featured_order']}
					value={
						entry.featured_status
							? `#${entry.featured_order}`
							: null
					}
				/>
				<ViewField
					label={translations['article.field.featured_expire_at']}
					value={
						entry.featured_expire_at
							? formatDate(entry.featured_expire_at, 'date-time')
							: null
					}
				/>
			</ViewSection>

			<ViewSection
				title={translations['article.section.timestamps']}
				layout="rows"
			>
				<ViewRow>
					<ViewField
						label={translations['article.field.publish_at']}
						value={
							entry.publish_at
								? formatDate(entry.publish_at, 'date-time')
								: null
						}
					/>
					<ViewField
						label={translations['article.field.archive_at']}
						value={
							entry.archive_at
								? formatDate(entry.archive_at, 'date-time')
								: null
						}
					/>
				</ViewRow>

				<ViewRow>
					<ViewField
						label={translations['article.field.created_at']}
						value={formatDate(entry.created_at, 'date-time')}
					/>
					<ViewField
						label={translations['article.field.updated_at']}
						value={formatDate(entry.updated_at, 'date-time')}
					/>
					{entry.deleted_at && (
						<ViewField
							label={translations['article.field.deleted_at']}
							value={
								<span className="text-danger">
									{formatDate(entry.deleted_at, 'date-time')}
								</span>
							}
						/>
					)}
				</ViewRow>
			</ViewSection>
		</div>
	);
}
