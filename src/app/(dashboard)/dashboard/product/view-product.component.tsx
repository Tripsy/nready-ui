'use client';

import { useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';
import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { StockVariant } from '@/app/(dashboard)/dashboard/warehouse-movement/stock-variant.component';
import { FormComponentSelect } from '@/components/form/form-element.component';
import { ManagerLanguageSwitcher } from '@/components/manager-language-switcher.component';
import {
	ErrorComponent,
	LoadingComponent,
} from '@/components/status.component';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getLanguageClient } from '@/config/translate.setup';
import {
	formatDate,
	ISO_WEEKDAY_KEYS,
	ISO_WEEKDAYS,
} from '@/helpers/date.helper';
import { DisplayStatus, displayImage } from '@/helpers/display.helper';
import { renderMarkdown } from '@/helpers/markdown.helper';
import { requestFind } from '@/helpers/services.helper';
import {
	enumTranslationKeys,
	replaceVars,
	translateEnumLabel,
} from '@/helpers/string.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import { hasPermission } from '@/models/account.model';
import {
	getImageContent,
	type ImageModel,
	ImageSectionEnum,
	showImage,
} from '@/models/image.model';
import {
	displayOptionLabel,
	ProductCompositionEnum,
	type ProductModel,
	type ProductOptionPriceType,
	ProductTypeEnum,
	ProductUnitEnum,
	type ProductVariantType,
	ProductVatCategoryEnum,
	toCategoryRefs,
	toTagRefs,
} from '@/models/product.model';
import { useAuth } from '@/providers/auth.provider';
import type { Language } from '@/types/common.type';
import type { EntityId } from '@/types/entity-id.type';

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
	'product.field.variant_sku',
	'product.field.vat_category',
	'product.section.catalog_window',
	'product.section.description',
	'product.section.info',
	'product.section.options',
	'product.section.stock',
	'product.section.ordering_interval',
	'product.section.timestamps',
	'product.section.variants',
	'product.section.tab_details',
	'product.section.tab_variants',
	'product.section.variant_images',
	'product.text.no_variant_images',
	'product.text.images_loading',
	'product.text.images_load_failed',
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
	'product.text.no_tracked_variants',
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

/** The SKU, marked when it is the product's default variant. */
function displayVariantSku(
	variant: ProductVariantType,
	translations: Readonly<Record<string, string>>,
): string {
	return variant.is_default
		? replaceVars(translations['product.text.sku_default'], {
				sku: variant.sku,
			})
		: variant.sku;
}

/**
 * Live stock for the product's tracked variants, one at a time - the same window the ledger and
 * the low-stock report open, so the figures read the same wherever a variant is looked at. One
 * variant is shown at a time because each is its own uncached request; the default variant is
 * the one most often asked about, so it opens first when it tracks stock. Picked from a select,
 * which keeps fitting where a row of buttons wraps once a product carries more than a handful.
 */
function StockProduct({
	variants,
	translations,
}: {
	variants: ProductVariantType[];
	translations: Readonly<Record<string, string>>;
}) {
	const selectId = useId();

	// A variant the API has not stored yet has no id, and nothing was ever received against it
	const tracked = variants.filter(
		(variant): variant is ProductVariantType & { id: EntityId } =>
			variant.track_stock && variant.id !== undefined,
	);

	const [selectedId, setSelectedId] = useState<EntityId | undefined>(
		() => (tracked.find((variant) => variant.is_default) ?? tracked[0])?.id,
	);

	if (tracked.length === 0 || selectedId === undefined) {
		return (
			<p className="text-sm text-muted">
				{translations['product.text.no_tracked_variants']}
			</p>
		);
	}

	return (
		<div className="space-y-4">
			{tracked.length > 1 && (
				<div className="max-w-80">
					<FormComponentSelect<{ stock_variant_id: string }>
						labelText={translations['product.field.variant_sku']}
						id={selectId}
						fieldName="stock_variant_id"
						fieldValue={String(selectedId)}
						disabled={false}
						className="font-mono"
						options={tracked.map((variant) => ({
							label: displayVariantSku(variant, translations),
							value: String(variant.id),
						}))}
						onChange={(value) => {
							// Nothing to clear to - an empty pick keeps the current variant
							const next = tracked.find(
								(variant) => String(variant.id) === value,
							);

							if (next) {
								setSelectedId(next.id);
							}
						}}
					/>
				</div>
			)}

			{/* Keyed so a switch remounts the panel rather than flashing the previous figures */}
			<StockVariant
				key={selectedId}
				entries={[{ variant_id: selectedId }]}
			/>
		</div>
	);
}

/**
 * Generous on purpose: the listing pages, and this section shows every variant's gallery at
 * once rather than a page of it. A product past this many variant images is cut off silently.
 */
const VARIANT_IMAGES_LIMIT = 200;

/**
 * Each variant's gallery, grouped under its SKU. One request for all of them - the image
 * listing takes a list of `entity_id`s - rather than one per variant. A variant with no images
 * is left out; the manager window (`ManagerImagesProduct`) is where they are added.
 */
function VariantImagesProduct({
	productId,
	variants,
	language,
	translations,
}: {
	productId: EntityId;
	variants: ProductVariantType[];
	language: Language;
	translations: Readonly<Record<string, string>>;
}) {
	// A variant not stored yet has no id, so nothing can be filed against it
	const saved = variants.filter(
		(variant): variant is ProductVariantType & { id: EntityId } =>
			variant.id !== undefined,
	);
	const ids = saved.map((variant) => variant.id);

	const { data, isLoading, isError } = useQuery({
		queryKey: ['product', 'variant-images', productId, ids],
		queryFn: async () => {
			const response = await requestFind<ImageModel>('image', {
				filter: {
					section: ImageSectionEnum.PRODUCT_VARIANT,
					entity_id: ids,
				},
				// The order the manager lists them in, so both read the same
				order_by: 'sort_order',
				direction: 'DESC',
				limit: VARIANT_IMAGES_LIMIT,
			});

			// `requestFind` resolves to `undefined` without a payload, which TanStack Query
			// rejects as query data
			if (!response) {
				throw new Error('Could not retrieve variant images');
			}

			return response.entries;
		},
		enabled: ids.length > 0,
	});

	if (isLoading) {
		return (
			<LoadingComponent
				description={translations['product.text.images_loading']}
			/>
		);
	}

	if (isError) {
		return (
			<ErrorComponent
				description={translations['product.text.images_load_failed']}
			/>
		);
	}

	const byVariant = new Map<EntityId, ImageModel[]>();

	for (const image of data ?? []) {
		const list = byVariant.get(image.entity_id);

		if (list) {
			list.push(image);
		} else {
			byVariant.set(image.entity_id, [image]);
		}
	}

	// In the variant list's order, not the images', so the two sections line up
	const withImages = saved.filter((variant) => byVariant.has(variant.id));

	if (withImages.length === 0) {
		return (
			<p className="text-sm text-muted">
				{translations['product.text.no_variant_images']}
			</p>
		);
	}

	return (
		<div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
			{withImages.map((variant) => (
				<div key={variant.id} className="space-y-2">
					<p className="font-mono text-xs text-muted">
						{displayVariantSku(variant, translations)}
					</p>
					<div className="flex flex-wrap gap-2">
						{byVariant.get(variant.id)?.map((image) => (
							<div
								key={image.id}
								className="h-16 w-16 overflow-hidden rounded-md border border-border bg-surface-secondary/30"
							>
								{displayImage({
									src: showImage(image.path, image.storage),
									alt:
										getImageContent(image, language)
											?.title ?? variant.sku,
								})}
							</div>
						))}
					</div>
				</div>
			))}
		</div>
	);
}

/**
 * The variants tab - the price list per variant and, under it, their images and stock. Mounted
 * only while its tab is open, so the image and stock reads fire when someone actually looks
 * rather than every time the product window opens. The variants themselves come with the
 * product read, so listing them costs no request of its own.
 */
function VariantsProduct({
	productId,
	variants,
	language,
	canReadStock,
	canReadImages,
	translations,
}: {
	productId: EntityId;
	variants: ProductVariantType[];
	language: Language;
	canReadStock: boolean;
	canReadImages: boolean;
	translations: Readonly<Record<string, string>>;
}) {
	return (
		<div className="space-y-6">
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
							label={displayVariantSku(variant, translations)}
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

			{canReadImages && (
				<ViewSection
					title={translations['product.section.variant_images']}
					layout="rows"
				>
					<VariantImagesProduct
						productId={productId}
						variants={variants}
						language={language}
						translations={translations}
					/>
				</ViewSection>
			)}

			{canReadStock && (
				<ViewSection
					title={translations['product.section.stock']}
					layout="rows"
				>
					<StockProduct
						variants={variants}
						translations={translations}
					/>
				</ViewSection>
			)}
		</div>
	);
}

export function ViewProduct({ entry }: { entry: ProductModel }) {
	const { translations } = useTranslation(TRANSLATION_KEYS);
	const { auth } = useAuth();

	/*
	 * Left out rather than shown failing without the grant - the stock read answers 403. A
	 * bundle has no stock of its own (its variants never track it), so it gets no section.
	 */
	const canReadStock =
		hasPermission(auth, 'warehouse-movement', 'read') &&
		entry.composition !== ProductCompositionEnum.BUNDLE;

	// Left out rather than shown failing without the grant - the image listing answers 403
	const canReadImages = hasPermission(auth, 'image', 'find');

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

	// Controlled so the variants panel renders only while it is the open tab - see `VariantsProduct`
	const [tab, setTab] = useState<string>('details');

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

			<Tabs
				selectedKey={tab}
				onSelectionChange={(key) => setTab(String(key))}
				className="w-full"
			>
				<TabsList>
					<TabsTrigger id="details">
						{translations['product.section.tab_details']}
					</TabsTrigger>
					<TabsTrigger id="variants">
						{translations['product.section.tab_variants']}
						<span className="ml-1.5 text-xs text-muted">
							{variants.length}
						</span>
					</TabsTrigger>
				</TabsList>

				<TabsContent id="details" className="space-y-6">
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
						{entry.composition !==
							ProductCompositionEnum.BUNDLE && (
							<ViewField
								label={translations['product.field.brand']}
								value={entry.brand?.name ?? '-'}
							/>
						)}
						<ViewField
							label={translations['product.field.categories']}
							value={
								categories.length
									? categories
											.map((ref) => ref.label)
											.join(', ')
									: '-'
							}
						/>
						<ViewField
							label={translations['product.field.tags']}
							value={
								tags.length
									? tags.map((r) => r.label).join(', ')
									: '-'
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
					<ViewSection
						title={translations['product.section.catalog_window']}
					>
						<ViewField
							label={translations['product.field.available_from']}
							value={
								entry.available_from
									? formatDate(
											entry.available_from,
											'date-time',
										)
									: '-'
							}
						/>
						<ViewField
							label={
								translations['product.field.available_until']
							}
							value={
								entry.available_until
									? formatDate(
											entry.available_until,
											'date-time',
										)
									: '-'
							}
						/>
						<ViewField
							label={
								translations['product.field.discontinued_at']
							}
							value={
								entry.discontinued_at
									? formatDate(
											entry.discontinued_at,
											'date-time',
										)
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
						title={
							translations['product.section.ordering_interval']
						}
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

					{/*
					 * A delta is measured against a variant's price, which lives on the variants tab - the
					 * figures here only mean anything read against that list.
					 */}
					<ViewSection
						title={replaceVars(
							translations['product.section.options'],
							{
								length: optionGroups.length,
							},
						)}
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

					<ViewSection
						title={translations['product.section.timestamps']}
					>
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
										{formatDate(
											entry.deleted_at,
											'date-time',
										)}
									</span>
								}
							/>
						)}
					</ViewSection>
				</TabsContent>

				{/*
				 * `TabsContent` force-mounts every panel (see `ui/tabs.tsx`), so the on-demand part
				 * is the conditional child, not the panel.
				 */}
				<TabsContent id="variants">
					{tab === 'variants' && (
						<VariantsProduct
							productId={entry.id}
							variants={variants}
							language={language}
							canReadStock={canReadStock}
							canReadImages={canReadImages}
							translations={translations}
						/>
					)}
				</TabsContent>
			</Tabs>
		</div>
	);
}
