'use client';

import { useState } from 'react';
import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { ManagerLanguageSwitcher } from '@/components/manager-language-switcher.component';
import { getLanguageClient } from '@/config/translate.setup';
import {
	formatDate,
	ISO_WEEKDAY_KEYS,
	ISO_WEEKDAYS,
} from '@/helpers/date.helper';
import { DisplayStatus } from '@/helpers/display.helper';
import { renderMarkdown } from '@/helpers/markdown.helper';
import {
	enumTranslationKeys,
	replaceVars,
	translateEnumLabel,
} from '@/helpers/string.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import {
	displayOptionLabel,
	ProductCompositionEnum,
	type ProductModel,
	type ProductOptionPriceType,
	ProductTypeEnum,
	ProductUnitEnum,
	ProductVatCategoryEnum,
	toCategoryRefs,
	toTagRefs,
} from '@/models/product.model';
import type { Language } from '@/types/common.type';

const TRANSLATION_KEYS = [
	'product.field.available_from',
	'product.field.available_until',
	'product.field.categories',
	'product.field.composition',
	'product.field.created_at',
	'product.field.deleted_at',
	'product.field.discontinued_at',
	'product.field.id',
	'product.field.name',
	'product.field.tags',
	'product.field.type',
	'product.field.unit',
	'product.field.updated_at',
	'product.field.vat_category',
	'product.section.catalog_window',
	'product.section.description',
	'product.section.info',
	'product.section.options',
	'product.section.ordering_interval',
	'product.section.timestamps',
	'product.section.variants',
	'product.text.n_a',
	'product.text.no_questions_ordered_as_it_is',
	'product.text.no_restriction_orderable_at_any_time',
	'product.field.brand',
	'product.text.all_day',
	'product.text.every_day',
	'product.text.cardinality_any',
	'product.text.cardinality_optional',
	'product.text.cardinality_required',
	'product.text.no_price_effect',
	'product.text.no_variants_loaded',
	'product.text.sku_default',
	'product.text.no_price',
	...ISO_WEEKDAY_KEYS,
	...enumTranslationKeys('product.enum.type', ProductTypeEnum),
	...enumTranslationKeys('product.enum.composition', ProductCompositionEnum),
	...enumTranslationKeys('product.enum.unit', ProductUnitEnum),
	...enumTranslationKeys('product.enum.vat_category', ProductVatCategoryEnum),
] as const;

/**
 * The hours a window covers. Postgres hands a `time` column back as `HH:MM:SS`, whose seconds are
 * always zero here and only add noise; null in both columns is an all-day window.
 */
function displayHours(
	startsAt: string | null,
	endsAt: string | null,
	translations: Readonly<Record<string, string>>,
): string {
	if (!startsAt || !endsAt) {
		return translations['product.text.all_day'];
	}

	return `${startsAt.slice(0, 5)} – ${endsAt.slice(0, 5)}`;
}

/** `null` means every day, which is a value rather than a missing one. */
function displayWeekday(
	dayOfWeek: number | null,
	translations: Readonly<Record<string, string>>,
): string {
	if (dayOfWeek === null) {
		return translations['product.text.every_day'];
	}

	const labelKey = ISO_WEEKDAYS.find(
		(weekday) => weekday.value === dayOfWeek,
	)?.labelKey;

	return labelKey ? translations[labelKey] : String(dayOfWeek);
}

/**
 * How many answers a question accepts. Restated in words because `min_select` / `max_select` are
 * its only expression - there is no required flag to read instead - and `null` as the maximum is
 * a value ("no upper bound") rather than a missing one.
 */
function displayCardinality(
	minSelect: number | null,
	maxSelect: number | null,
	translations: Readonly<Record<string, string>>,
): string {
	const min = minSelect ?? 0;
	const max =
		maxSelect === null
			? translations['product.text.cardinality_any']
			: String(maxSelect);

	return replaceVars(
		translations[
			min === 0
				? 'product.text.cardinality_optional'
				: 'product.text.cardinality_required'
		],
		{ min, max },
	);
}

/**
 * What one answer does to the price, per market. Signed on purpose - an answer that declines
 * something the price already includes carries a negative delta, and a bare number would read
 * as a surcharge.
 */
function displayDeltas(
	prices: ProductOptionPriceType[],
	translations: Readonly<Record<string, string>>,
): string {
	if (prices.length === 0) {
		return translations['product.text.no_price_effect'];
	}

	return prices
		.map((price) => {
			const delta = price.price_delta ?? 0;

			return `${delta > 0 ? '+' : ''}${delta} ${price.currency}`;
		})
		.join(' · ');
}

export function ViewProduct({ entry }: { entry: ProductModel }) {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const contents = entry.contents ?? [];
	const languages = contents.map((content) => content.language);

	/*
	 * The request's own language when the product has a translation for it, otherwise the first
	 * one it does carry - a product filed only in Romanian should open showing Romanian rather
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
	const optionGroups = entry.option_groups ?? [];

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">
					{translations['product.field.id']}
				</span>{' '}
				{entry.id}
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

			<ViewSection title={translations['product.section.info']}>
				<ViewField
					label={translations['product.field.name']}
					value={content?.label}
				/>
				<ViewField
					label={translations['product.field.type']}
					value={translateEnumLabel(
						translations,
						'product.enum.type',
						entry.type,
					)}
				/>
				<ViewField
					label={translations['product.field.composition']}
					value={translateEnumLabel(
						translations,
						'product.enum.composition',
						entry.composition,
					)}
				/>
				<ViewField
					label={translations['product.field.unit']}
					value={translateEnumLabel(
						translations,
						'product.enum.unit',
						entry.unit,
					)}
				/>
				<ViewField
					label={translations['product.field.vat_category']}
					value={translateEnumLabel(
						translations,
						'product.enum.vat_category',
						entry.vat_category,
					)}
				/>
				{/* A bundle names no brand - see `prepareProductBundleParams`. */}
				{entry.composition !== ProductCompositionEnum.BUNDLE && (
					<ViewField
						label={translations['product.field.brand']}
						value={entry.brand?.name ?? '-'}
					/>
				)}
				<ViewField
					label={translations['product.field.categories']}
					value={
						categories.length
							? categories.map((ref) => ref.label).join(', ')
							: '-'
					}
				/>
				<ViewField
					label={translations['product.field.tags']}
					value={
						tags.length ? tags.map((r) => r.label).join(', ') : '-'
					}
				/>
			</ViewSection>

			<ViewSection
				title={translations['product.section.description']}
				layout="rows"
			>
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
					<span className="text-sm text-muted">
						{translations['product.text.n_a']}
					</span>
				)}
			</ViewSection>

			{/*
			 * The catalog window, which is what `sale_status` above is computed from - the two
			 * are shown together so a surprising status has its cause next to it.
			 */}
			<ViewSection title={translations['product.section.catalog_window']}>
				<ViewField
					label={translations['product.field.available_from']}
					value={
						entry.available_from
							? formatDate(entry.available_from, 'date-time')
							: '-'
					}
				/>
				<ViewField
					label={translations['product.field.available_until']}
					value={
						entry.available_until
							? formatDate(entry.available_until, 'date-time')
							: '-'
					}
				/>
				<ViewField
					label={translations['product.field.discontinued_at']}
					value={
						entry.discontinued_at
							? formatDate(entry.discontinued_at, 'date-time')
							: '-'
					}
				/>
			</ViewSection>

			{/*
			 * Below the catalog window on purpose: these are the recurring hours *within* that
			 * window, and reading them next to it is what makes the distinction land. No rows
			 * means unrestricted, which is stated rather than shown as an empty list.
			 */}
			<ViewSection
				title={translations['product.section.ordering_interval']}
				layout="rows"
			>
				{availabilities.length === 0 ? (
					<span className="text-sm text-muted">
						{
							translations[
								'product.text.no_restriction_orderable_at_any_time'
							]
						}
					</span>
				) : (
					<ul className="space-y-1 text-sm">
						{availabilities.map((availability) => (
							<li
								key={`${availability.day_of_week ?? 'all'}-${availability.starts_at}-${availability.ends_at}`}
							>
								<span className="font-medium">
									{displayWeekday(
										availability.day_of_week,
										translations,
									)}
								</span>{' '}
								{displayHours(
									availability.starts_at,
									availability.ends_at,
									translations,
								)}
							</li>
						))}
					</ul>
				)}
			</ViewSection>

			<ViewSection
				title={replaceVars(translations['product.section.variants'], {
					length: variants.length,
				})}
			>
				{variants.length === 0 ? (
					<ViewField
						label="-"
						value={translations['product.text.no_variants_loaded']}
					/>
				) : (
					variants.map((variant) => (
						<ViewField
							key={variant.sku}
							label={
								variant.is_default
									? replaceVars(
											translations[
												'product.text.sku_default'
											],
											{
												sku: variant.sku,
											},
										)
									: variant.sku
							}
							value={
								variant.prices.length
									? variant.prices
											.map(
												(price) =>
													`${price.sale_price ?? '-'} ${price.currency}`,
											)
											.join(' · ')
									: translations['product.text.no_price']
							}
						/>
					))
				)}
			</ViewSection>

			{/*
			 * Below the variants because a delta is measured against a variant's price, and
			 * reading the two in that order is what makes the figures mean anything.
			 */}
			<ViewSection
				title={replaceVars(translations['product.section.options'], {
					length: optionGroups.length,
				})}
				layout="rows"
			>
				{optionGroups.length === 0 ? (
					<span className="text-sm text-muted">
						{
							translations[
								'product.text.no_questions_ordered_as_it_is'
							]
						}
					</span>
				) : (
					<ul className="space-y-3 text-sm">
						{optionGroups.map((group) => (
							<li key={group.label_id}>
								<span className="font-medium">
									{displayOptionLabel(
										group.label,
										language,
										group.label_id,
									)}
								</span>{' '}
								<span className="text-muted">
									{displayCardinality(
										group.min_select,
										group.max_select,
										translations,
									)}
								</span>
								<ul className="mt-1 space-y-0.5 pl-4">
									{group.options.map((option) => (
										<li key={option.label_id}>
											{displayOptionLabel(
												option.label,
												language,
												option.label_id,
											)}
											{option.is_default
												? ' (preselected)'
												: ''}
											<span className="text-muted">
												{' - '}
												{displayDeltas(
													option.prices,
													translations,
												)}
											</span>
										</li>
									))}
								</ul>
							</li>
						))}
					</ul>
				)}
			</ViewSection>

			<ViewSection title={translations['product.section.timestamps']}>
				<ViewField
					label={translations['product.field.created_at']}
					value={formatDate(entry.created_at, 'date-time')}
				/>
				<ViewField
					label={translations['product.field.updated_at']}
					value={formatDate(entry.updated_at, 'date-time')}
				/>
				{entry.deleted_at && (
					<ViewField
						label={translations['product.field.deleted_at']}
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
