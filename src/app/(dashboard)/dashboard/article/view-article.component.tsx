'use client';

import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDate } from '@/helpers/date.helper';
import { DisplayStatus } from '@/helpers/display.helper';
import { renderMarkdown } from '@/helpers/markdown.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import type { ArticleModel } from '@/models/article.model';

export function ViewArticle({ entry }: { entry: ArticleModel }) {
	const languageContents = entry.contents ?? [];
	const contentTabDefault = languageContents[0]?.language;

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">ID</span> {entry.id}
				<div className="max-w-60 ml-2">
					<DisplayStatus status={entry.status} dataSource="article" />
				</div>
			</div>

			<ViewSection title="Info">
				<ViewField
					label="Visibility"
					value={formatEnumLabel(entry.visibility)}
				/>
				<ViewField
					label="Source Mode"
					value={formatEnumLabel(entry.source_mode)}
				/>
				<ViewField
					label="Featured"
					value={
						entry.featured_status
							? `${formatEnumLabel(entry.featured_status)} (#${entry.featured_order})`
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
				<ViewField label="Author" value={entry.author?.name} />
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
				<ViewField
					label="Layout"
					value={entry.layout ? formatEnumLabel(entry.layout) : null}
				/>
				<ViewField
					label="Public At"
					value={
						entry.public_at
							? formatDate(entry.public_at, 'date-time')
							: null
					}
				/>
				<ViewField
					label="Categories"
					value={(entry.categories ?? []).length.toString()}
				/>
				<ViewField
					label="Tags"
					value={(entry.tags ?? []).length.toString()}
				/>
			</ViewSection>

			{entry.visibility_rule && (
				<ViewSection title="Visibility rule">
					<ViewField
						label="Requires sign-in"
						value={
							entry.visibility_rule.requires_auth ? 'Yes' : 'No'
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
				</ViewSection>
			)}

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

			{languageContents.length > 0 && (
				<div>
					<Tabs
						defaultSelectedKey={contentTabDefault}
						className="w-full"
					>
						<div className="flex items-center justify-center border-b border-line pb-2 mb-4">
							<h3 className="font-bold whitespace-nowrap">
								Language specific
							</h3>
							<TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
								{languageContents.map((content) => (
									<TabsTrigger
										key={content.language}
										id={content.language}
									>
										{content.language.toUpperCase()}
									</TabsTrigger>
								))}
							</TabsList>
						</div>

						{languageContents.map((content) => (
							<TabsContent
								key={`content-${content.language}`}
								id={content.language}
							>
								<div className="space-y-4">
									<div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
										<ViewField
											label="Title"
											value={content.title}
										/>
										<ViewField
											label="Slug"
											value={content.slug}
										/>
										<ViewField
											label="Brief"
											value={content.brief}
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
									</div>

									{/*
									 * The stored value is markdown; this is the only place the
									 * dashboard turns it into HTML. `renderMarkdown` sanitizes,
									 * which is what makes the injection safe.
									 */}
									<div
										className="markdown-body rounded-md border border-line p-4"
										// biome-ignore lint/security/noDangerouslySetInnerHtml: markdown rendered and sanitized by `renderMarkdown`
										dangerouslySetInnerHTML={{
											__html: renderMarkdown(
												content.content,
											),
										}}
									/>
								</div>
							</TabsContent>
						))}
					</Tabs>
				</div>
			)}

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
		</div>
	);
}
