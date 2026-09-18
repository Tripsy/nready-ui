'use client';

import Link from 'next/link';
import type { JSX } from 'react';
import { DisplayButton } from '@/app/(dashboard)/_components/data-table-value';
import { Icons } from '@/components/icon.component';
import Routes from '@/config/routes.setup';
import type { AccountModel } from '@/models/account.model';
import { hasPermission } from '@/models/account.model';
import type { ProductModel } from '@/models/product.model';
import { type ReviewModel, resolveReviewProduct } from '@/models/review.model';

/**
 * The reviewed product as one cell: a link out to its public page, then its name and code.
 *
 * A function returning JSX rather than a component, the shape `DataTableValue` itself has - the
 * definition files are `.ts` and call these to build a cell. Nothing here holds state, and the one
 * piece that needs a hook (`DisplayButton`, for its toast) is returned as an element for React to
 * render.
 *
 * The two act on different things on purpose. The **name** opens the product's detail window on
 * this page, which is where a moderator decides whether a review is fair - it is the same
 * `DisplayButton` every other cross-entity reference in the dashboard uses, so it stops the press
 * from reaching the row and resolves the product itself. The **icon** leaves the dashboard for the
 * storefront page a reader would see, in a new tab, so the queue behind it is not lost.
 *
 * Neither is unconditional. The link needs a slug, which a product with no translation in the
 * request's language does not have; the window needs `product` read permission, without which the
 * name renders as plain text rather than as a button that would answer 403.
 */
export function reviewTargetValue(
	entry: ReviewModel,
	auth: AccountModel | null,
): JSX.Element {
	const { label, slug, sku } = resolveReviewProduct(entry);

	const text = sku ? `${label} (${sku})` : label;

	return (
		<span className="flex gap-1">
			{slug && (
				<Link
					href={Routes.get('product-view', { slug })}
					target="_blank"
					rel="noopener noreferrer"
					title="Open the product page in a new tab"
					className="shrink-0 opacity-60 hover:opacity-100"
					/*
					 * The row selects on `pointerdown`, and a selection that renders the action
					 * bar shifts every row down - so the anchor would move out from under the
					 * cursor before the click landed. Stopped here for the same reason
					 * `DisplayButton` does it.
					 */
					onPointerDown={(event) => event.stopPropagation()}
					onMouseDown={(event) => event.stopPropagation()}
					onClick={(event) => event.stopPropagation()}
				>
					<Icons.ExternalLink className="h-3.5 w-3.5 mt-0.5" />
				</Link>
			)}

			{hasPermission(auth, 'product', 'read') ? (
				<DisplayButton<ProductModel>
					buttonAppearance={{
						label: text,
						title: 'View product details',
					}}
					action="view"
					dataSource="product"
					entryOrId={entry.product_id}
				/>
			) : (
				<span>{text}</span>
			)}
		</span>
	);
}
