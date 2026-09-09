'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { ManagerImages } from '@/components/manager-images.component';
import { Button } from '@/components/ui/button';
import { cn } from '@/helpers/css.helper';
import { requestFind } from '@/helpers/services.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import { hasPermission } from '@/models/account.model';
import {
	type ImageSection,
	ImageSectionEnum,
	ImageTypeEnum,
} from '@/models/image.model';
import type { ProductModel } from '@/models/product.model';
import type { ProductVariantModel } from '@/models/product-variant.model';
import { useAuth } from '@/providers/auth.provider';
import { LanguageEnum } from '@/types/common.type';

const IMAGE_TYPES = [ImageTypeEnum.GALLERY];
const LANGUAGES = Object.values(LanguageEnum);

/*
 * Captions are per-language for the same reason the article gallery's are: the images render
 * beside the product's own translated content, so a caption kept only in the default language
 * would break that pairing on every other storefront language.
 */
const ATTRIBUTE_FIELDS = {
	title: 'required' as const,
	description: 'optional' as const,
};

const TRANSLATION_KEYS = [
	'product.action.managerImages.target_product',
	'product.action.managerImages.target_variants',
] as const;

/** Which gallery the rail is pointed at - the product's, or one variant's. */
type ImageTarget = {
	section: ImageSection;
	entity_id: number;
	label: string;
	/** Marked in the rail, so the gallery a single-variant product sells through is obvious. */
	isDefault?: boolean;
};

/**
 * The product's gallery and its variants' galleries, behind one button.
 *
 * A variant owns images the same way a product does - `(section, entity_id)` with
 * `product_variant` as the section - so the same manager serves both and only the target
 * changes. `ManagerImages` is mounted with a `key` per target so switching remounts it: the
 * component holds staged, not-yet-uploaded files in local state, and carrying that state across
 * a switch would file them against the wrong gallery.
 *
 * There is no entry for a variant that has not been saved. A variant's id is what an image is
 * filed under, and it does not exist until the product's form is submitted - which is also why
 * this lives behind a window action on a saved row rather than inside the form. The rail simply
 * lists what the backend has.
 */
export function ManagerImagesProduct({ entries }: { entries: ProductModel[] }) {
	const { auth } = useAuth();
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const model = entries[0];

	const permissions = useMemo(
		// A variant's images are the product's to edit - the same permission the backend and the
		// upload route both gate them by. See `imagePermissionEntity`.
		() => ({
			edit: !model.deleted_at && hasPermission(auth, 'product', 'update'),
		}),
		[model.deleted_at, auth],
	);

	/*
	 * The variants are fetched rather than read off `model`: the row this window opens from comes
	 * from the product listing, which joins only the default variant's prices.
	 */
	const { data: variants } = useQuery({
		queryKey: ['product-variants', model.id],
		queryFn: () =>
			requestFind<ProductVariantModel>('product-variant', {
				filter: { product_id: model.id },
				order_by: 'id',
				direction: 'ASC',
				limit: 100,
			}),
	});

	const targets = useMemo<ImageTarget[]>(() => {
		const productTarget: ImageTarget = {
			section: ImageSectionEnum.PRODUCT,
			entity_id: model.id,
			label: translations['product.action.managerImages.target_product'],
		};

		/*
		 * Ordered by `position`, which is what the variants tab stamps and what the storefront
		 * lists them by - the rail has to read in the same order as the form the operator just
		 * left. The endpoint orders by id (descending by default), which is creation order and
		 * stops matching the moment a row is moved.
		 */
		const variantTargets = [...(variants?.entries ?? [])]
			.sort(
				(left, right) =>
					left.position - right.position || left.id - right.id,
			)
			.map((variant) => ({
				section: ImageSectionEnum.PRODUCT_VARIANT,
				entity_id: variant.id,
				/*
				 * Named by SKU, not by its axis values: the dashboard read joins no term contents
				 * for variant attributes, so the wording ("512 gb") is simply not in this payload
				 * - and a SKU is what an operator recognises anyway.
				 */
				label: variant.sku,
				isDefault: variant.is_default,
			}));

		return [productTarget, ...variantTargets];
	}, [model.id, variants, translations]);

	const [selectedKey, setSelectedKey] = useState<string>(
		`${ImageSectionEnum.PRODUCT}:${model.id}`,
	);

	const selected =
		targets.find(
			(target) => `${target.section}:${target.entity_id}` === selectedKey,
		) ?? targets[0];

	return (
		<div className="space-y-4">
			{/*
			 * Hidden until there is a choice to make. A product with no variants beyond its
			 * default one has a single gallery, and a rail of one button is only noise.
			 */}
			{targets.length > 1 && (
				<div className="flex flex-wrap items-center gap-2 border-b border-line pb-4">
					<span className="mr-1 text-xs uppercase tracking-wide text-muted">
						{
							translations[
								'product.action.managerImages.target_variants'
							]
						}
					</span>

					{targets.map((target) => {
						const key = `${target.section}:${target.entity_id}`;

						return (
							<Button
								key={key}
								type="button"
								size="sm"
								variant={
									key === selectedKey ? 'default' : 'outline'
								}
								aria-pressed={key === selectedKey}
								className={cn(
									target.section ===
										ImageSectionEnum.PRODUCT_VARIANT &&
										'font-mono',
								)}
								onClick={() => setSelectedKey(key)}
							>
								{target.label}
								{target.isDefault && ' ★'}
							</Button>
						);
					})}
				</div>
			)}

			<ManagerImages
				key={selectedKey}
				section={selected.section}
				entity_id={selected.entity_id}
				types={IMAGE_TYPES}
				permissions={permissions}
				attributeFields={ATTRIBUTE_FIELDS}
				attributeLanguages={LANGUAGES}
			/>
		</div>
	);
}
