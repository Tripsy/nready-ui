'use client';

import Image from 'next/image';
import { useState } from 'react';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';
import { cn } from '@/helpers/css.helper';
import { showImage } from '@/models/image.model';
import type { ProductCoverImageType } from '@/models/product.model';

/** The main image's fallback box, for a row that never recorded its dimensions. */
const MAIN_WIDTH = 1200;
const MAIN_HEIGHT = 675;

/** The thumbnail box, in CSS pixels. Square, so the grid stays one shape whatever it holds. */
const THUMBNAIL_SIZE = 72;

/**
 * The product's pictures: the one on show, the rest as a two-column grid beside it, and the
 * full-size view behind both.
 *
 * A client component, for the swap and the lightbox. It still renders on the server, so the main
 * image is in the HTML a crawler receives and `priority` still means something.
 *
 * The thumbnails are **not** a variant chooser, even though some of them are variant photographs.
 * Choosing a variant changes the price, the SKU and what is added to the cart, and that decision
 * belongs to the chooser above, which is a set of links carrying the SKU in the URL. Clicking a
 * picture here changes only which picture is large.
 *
 * With one image there is nothing to choose between, so the grid is dropped and the main image
 * takes the full width - the lightbox still opens, since a single photograph is still worth
 * seeing at its own size.
 */
export function ProductGallery({
	images,
	label,
}: {
	images: ProductCoverImageType[];
	/** The product's name, for the alt text of a picture the reader opened deliberately. */
	label: string;
}) {
	/*
	 * The index rather than the id, because that is what the lightbox speaks: it reports the slide
	 * the reader arrowed to as a position in the list it was handed, and holding an id here would
	 * mean translating in both directions for nothing.
	 *
	 * Zero is the hero the page resolved - the variant's own when one was chosen, the product's
	 * otherwise - so arriving at `?variant=` still opens on that variant's picture.
	 */
	const [activeIndex, setActiveIndex] = useState(0);
	const [isOpen, setIsOpen] = useState(false);

	if (images.length === 0) {
		return null;
	}

	const active = images[activeIndex] ?? images[0];

	return (
		<>
			{/*
			 * `relative`, and the thumbnail grid is positioned against it rather than laid out in
			 * the row. A scroll container has to be bounded by something, and the only thing that
			 * knows how tall this row is is the picture: as an ordinary flex item the grid would
			 * set the row's height instead of being cut to it, and a product with a dozen
			 * photographs would decide how tall its own hero is.
			 */}
			<div className="relative mt-8 flex gap-3">
				<button
					type="button"
					onClick={() => setIsOpen(true)}
					// The whole picture is the control, so it keeps the image's own box rather
					// than being a button drawn around one.
					className="block min-w-0 flex-1 cursor-zoom-in overflow-hidden rounded-2xl"
				>
					<Image
						src={showImage(active.path, active.storage)}
						// The stored dimensions are the real ones; `next/image` needs them to
						// reserve the space, and the CSS below is what actually sizes the box.
						width={active.properties?.width ?? MAIN_WIDTH}
						height={active.properties?.height ?? MAIN_HEIGHT}
						alt={label}
						priority
						className="aspect-video w-full object-cover"
						sizes="(min-width: 1024px) 560px, 100vw"
					/>
				</button>

				{images.length > 1 && (
					/*
					 * Holds the grid's width in the row; the grid itself is taken out of the flow
					 * above it, so it contributes no height of its own. Wider than the two
					 * thumbnails it holds, because the scrollbar is laid out inside it - at
					 * exactly their width the column gains a horizontal scrollbar as well.
					 */
					<div className="w-44 shrink-0">
						<ul className="absolute inset-y-0 right-0 grid w-44 auto-rows-min grid-cols-2 gap-2 overflow-y-auto">
							{images.map((image, index) => {
								const isActive = index === activeIndex;

								return (
									<li key={image.id}>
										<button
											type="button"
											onClick={() =>
												setActiveIndex(index)
											}
											aria-current={
												isActive ? 'true' : undefined
											}
											aria-label={label}
											className={cn(
												'block size-18 overflow-hidden rounded-xl border transition-colors',
												isActive
													? 'border-accent'
													: 'border-border hover:border-accent',
											)}
										>
											<Image
												src={showImage(
													image.path,
													image.storage,
												)}
												width={
													image.properties?.width ??
													THUMBNAIL_SIZE
												}
												height={
													image.properties?.height ??
													THUMBNAIL_SIZE
												}
												// Decorative: the button around it carries the
												// label, and an alt here would be announced twice.
												alt=""
												className="size-full object-cover"
												sizes={`${THUMBNAIL_SIZE}px`}
											/>
										</button>
									</li>
								);
							})}
						</ul>
					</div>
				)}
			</div>

			{/*
			 * The full-size view. Mounted only while it is open, so a page nobody clicks through
			 * never renders it.
			 *
			 * The slides carry the raw image URLs rather than `next/image`'s: the point of this
			 * view is the photograph at its own size, and the optimizer would hand back one sized
			 * for the box the reader just left.
			 *
			 * `view` carries the arrows and the swipe back into `activeIndex`, so closing the
			 * lightbox leaves the picture the reader stopped on as the one on the page.
			 */}
			{isOpen && (
				<Lightbox
					open
					close={() => setIsOpen(false)}
					index={activeIndex}
					on={{ view: ({ index }) => setActiveIndex(index) }}
					slides={images.map((image) => ({
						src: showImage(image.path, image.storage),
						width: image.properties?.width,
						height: image.properties?.height,
						alt: label,
					}))}
				/>
			)}
		</>
	);
}
