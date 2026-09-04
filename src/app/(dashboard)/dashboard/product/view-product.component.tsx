'use client';

import { useState } from 'react';
import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { ManagerLanguageSwitcher } from '@/components/manager-language-switcher.component';
import { getLanguageClient } from '@/config/translate.setup';
import { formatDate, isoWeekdayName } from '@/helpers/date.helper';
import { DisplayStatus } from '@/helpers/display.helper';
import { renderMarkdown } from '@/helpers/markdown.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import {
	type ProductModel,
	toCategoryRefs,
	toTagRefs,
} from '@/models/product.model';
import type { Language } from '@/types/common.type';

/**
 * The hours a window covers. Postgres hands a `time` column back as `HH:MM:SS`, whose seconds are
 * always zero here and only add noise; null in both columns is an all-day window.
 */
function displayHours(startsAt: string | null, endsAt: string | null): string {
	if (!startsAt || !endsAt) {
		return 'all day';
	}

	return `${startsAt.slice(0, 5)} – ${endsAt.slice(0, 5)}`;
}

/** `null` means every day, which is a value rather than a missing one. */
function displayWeekday(dayOfWeek: number | null): string {
	return dayOfWeek === null ? 'Every day' : isoWeekdayName(dayOfWeek);
}

export function ViewProduct({ entry }: { entry: ProductModel }) {
	const contents = entry.contents ?? [];
	const languages = contents.map((content) => content.language);

	/*
	 * The request's own language when the product has a translation for it, otherwise the first
	 * one it does carry — a product filed only in Romanian should open showing Romanian rather
	 * than an empty panel.
	 */
	const [language, setLanguage] = useState<Language>(() => {
		const preferred = getLanguageClient();

		return languages.includes(preferred) ? preferred : languages[0];
	});

	const content = contents.find((value) => value.language === language);

	// Link wording follows the switcher, so the whole panel reads in one language at a time.
	const categories = toCategoryRefs(entry, language);
	const tags = toTagRefs(entry, language);
	const variants = entry.variants ?? [];
	const availabilities = entry.availabilities ?? [];

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">ID</span> {entry.id}
				<div className="max-w-60 ml-2">
					<DisplayStatus
						status={entry.workflow}
						dataSource="product"
					/>
				</div>
				<div className="max-w-60">
					<DisplayStatus
						status={entry.sale_status}
						dataSource="product"
					/>
				</div>
			</div>

			{languages.length > 1 && (
				<ManagerLanguageSwitcher
					languages={languages}
					selected={language}
					onSelect={setLanguage}
				/>
			)}

			<ViewSection title="Info">
				<ViewField label="Name" value={content?.label} />
				<ViewField label="Type" value={formatEnumLabel(entry.type)} />
				<ViewField
					label="Composition"
					value={formatEnumLabel(entry.composition)}
				/>
				<ViewField label="Unit" value={formatEnumLabel(entry.unit)} />
				<ViewField
					label="VAT Category"
					value={formatEnumLabel(entry.vat_category)}
				/>
				<ViewField label="Brand" value={entry.brand?.name ?? '—'} />
				<ViewField
					label="Categories"
					value={
						categories.length
							? categories.map((ref) => ref.label).join(', ')
							: '—'
					}
				/>
				<ViewField
					label="Tags"
					value={
						tags.length ? tags.map((r) => r.label).join(', ') : '—'
					}
				/>
			</ViewSection>

			<ViewSection title="Description" layout="rows">
				{content?.description ? (
					/*
					 * The stored value is markdown; this and the manage form's preview are the
					 * only places the dashboard turns it into HTML. `renderMarkdown` sanitizes,
					 * which is what makes the injection safe.
					 */
					<div
						className="markdown-body"
						// biome-ignore lint/security/noDangerouslySetInnerHtml: markdown rendered and sanitized by `renderMarkdown`
						dangerouslySetInnerHTML={{
							__html: renderMarkdown(content.description),
						}}
					/>
				) : (
					<span className="text-sm text-muted">n/a</span>
				)}
			</ViewSection>

			{/*
			 * The catalog window, which is what `sale_status` above is computed from — the two
			 * are shown together so a surprising status has its cause next to it.
			 */}
			<ViewSection title="Catalog window">
				<ViewField
					label="Available From"
					value={
						entry.available_from
							? formatDate(entry.available_from, 'date-time')
							: '—'
					}
				/>
				<ViewField
					label="Available Until"
					value={
						entry.available_until
							? formatDate(entry.available_until, 'date-time')
							: '—'
					}
				/>
				<ViewField
					label="Discontinued At"
					value={
						entry.discontinued_at
							? formatDate(entry.discontinued_at, 'date-time')
							: '—'
					}
				/>
			</ViewSection>

			{/*
			 * Below the catalog window on purpose: these are the recurring hours *within* that
			 * window, and reading them next to it is what makes the distinction land. No rows
			 * means unrestricted, which is stated rather than shown as an empty list.
			 */}
			<ViewSection title="Ordering interval" layout="rows">
				{availabilities.length === 0 ? (
					<span className="text-sm text-muted">
						No restriction — orderable at any time while available.
					</span>
				) : (
					<ul className="space-y-1 text-sm">
						{availabilities.map((availability) => (
							<li
								key={`${availability.day_of_week ?? 'all'}-${availability.starts_at}-${availability.ends_at}`}
							>
								<span className="font-medium">
									{displayWeekday(availability.day_of_week)}
								</span>{' '}
								{displayHours(
									availability.starts_at,
									availability.ends_at,
								)}
							</li>
						))}
					</ul>
				)}
			</ViewSection>

			<ViewSection title={`Variants (${variants.length})`}>
				{variants.length === 0 ? (
					<ViewField label="—" value="No variants loaded" />
				) : (
					variants.map((variant) => (
						<ViewField
							key={variant.sku}
							label={`${variant.sku}${variant.is_default ? ' (default)' : ''}`}
							value={
								variant.prices.length
									? variant.prices
											.map(
												(price) =>
													`${price.sale_price ?? '—'} ${price.currency}`,
											)
											.join(' · ')
									: 'no price'
							}
						/>
					))
				)}
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
		</div>
	);
}
