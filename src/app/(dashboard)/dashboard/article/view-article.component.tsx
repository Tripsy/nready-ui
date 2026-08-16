'use client';

import { useState } from 'react';
import {
	ViewField,
	ViewRow,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { LanguageSwitcher } from '@/components/language-switcher.component';
import { getLanguageClient } from '@/config/translate.setup';
import { formatDate } from '@/helpers/date.helper';
import { DisplayStatus } from '@/helpers/display.helper';
import { renderMarkdown } from '@/helpers/markdown.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import {
	type ArticleModel,
	getArticleLinkLabels,
} from '@/models/article.model';

export function ViewArticle({ entry }: { entry: ArticleModel }) {
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
				<span className="font-semibold">ID</span> {entry.id}
				<div className="max-w-60 ml-2">
					<DisplayStatus status={entry.status} dataSource="article" />
				</div>
			</div>

			{content && (
				<>
					<LanguageSwitcher
						languages={languages}
						selected={content.language}
						onSelect={setLanguage}
					/>

					<ViewSection title="Info" layout="rows">
						<ViewRow>
							<ViewField
								label="Layout"
								value={
									entry.layout
										? formatEnumLabel(entry.layout)
										: null
								}
							/>
							<ViewField label="Title" value={content.title} />
						</ViewRow>

						<ViewRow>
							<ViewField
								label="Brief"
								value={content.brief}
								full
							/>
						</ViewRow>

						<ViewRow>
							<ViewField
								label="Categories"
								value={categoryLabels}
								full
							/>
						</ViewRow>

						<ViewRow>
							<ViewField label="Tags" value={tagLabels} full />
						</ViewRow>
					</ViewSection>

					<ViewSection title="Content" layout="rows">
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

					<ViewSection title="SEO" layout="rows">
						<ViewField label="Slug" value={content.slug} />
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
				</>
			)}

			<ViewSection title="Attribution">
				<ViewField
					label="Source Mode"
					value={formatEnumLabel(entry.source_mode)}
				/>
				<ViewField label="Author" value={entry.author?.name} />
			</ViewSection>

			{entry.source && (
				<ViewSection title="Source">
					<ViewField label="Label" value={entry.source.label} />
					<ViewField label="URL" value={entry.source.url} />
					<ViewField
						label="Disclaimer"
						value={entry.source.disclaimer}
					/>
					<ViewField label="About" value={entry.source.about} />
				</ViewSection>
			)}

			<ViewSection title="Visibility">
				<ViewField
					label="Visibility"
					value={formatEnumLabel(entry.visibility)}
				/>
				<ViewField
					label="Public At"
					value={
						entry.public_at
							? formatDate(entry.public_at, 'date-time')
							: null
					}
				/>
				{entry.visibility_rule && (
					<>
						<ViewField
							label="Requires sign-in"
							value={
								entry.visibility_rule.requires_auth
									? 'Yes'
									: 'No'
							}
						/>
						<ViewField
							label="Requires subscription"
							value={
								entry.visibility_rule.requires_subscription
									? 'Yes'
									: 'No'
							}
						/>
						<ViewField
							label="Allowed countries"
							value={
								entry.visibility_rule.allowed_countries?.join(
									', ',
								) ?? null
							}
						/>
					</>
				)}
			</ViewSection>

			<ViewSection title="Featured">
				<ViewField
					label="Status"
					value={
						entry.featured_status
							? formatEnumLabel(entry.featured_status)
							: null
					}
				/>
				<ViewField
					label="Order"
					value={
						entry.featured_status
							? `#${entry.featured_order}`
							: null
					}
				/>
				<ViewField
					label="Featured Until"
					value={
						entry.featured_expire_at
							? formatDate(entry.featured_expire_at, 'date-time')
							: null
					}
				/>
			</ViewSection>

			<ViewSection title="Timestamps" layout="rows">
				<ViewRow>
					<ViewField
						label="Publish At"
						value={
							entry.publish_at
								? formatDate(entry.publish_at, 'date-time')
								: null
						}
					/>
					<ViewField
						label="Archive At"
						value={
							entry.archive_at
								? formatDate(entry.archive_at, 'date-time')
								: null
						}
					/>
				</ViewRow>

				<ViewRow>
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
				</ViewRow>
			</ViewSection>
		</div>
	);
}
