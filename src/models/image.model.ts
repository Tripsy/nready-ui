import { Configuration } from '@/config/settings.config';
import {
	PermissionEntitiesSuggestions,
	type PermissionEntityType,
} from '@/models/permission.model';
import type { Language } from '@/types/common.type';
import type { ImagePropertiesType } from '@/types/image.type';

export const ImageSectionEnum = {
	PRODUCT: 'product',
	CATEGORY: 'category',
	BRAND: 'brand',
	ARTICLE: 'article',
	// A variant's own photographs, beside its product's. Mirrors the backend enum, where the
	// value is the owner's table name - hence the underscore, unlike the kebab-case permission
	// entities below.
	PRODUCT_VARIANT: 'product_variant',
} as const;

export type ImageSection =
	(typeof ImageSectionEnum)[keyof typeof ImageSectionEnum];

/**
 * Sections whose images anyone may see - what the storefront shows a visitor. On S3 they are
 * served through CloudFront (`showImage`), and the signed route hands them out without a
 * permission check; every other section stays behind its entity's `read` permission.
 *
 * The production bucket policy grants CloudFront read access to these prefixes and no other
 * (README, "Deployment"), so a section added here also needs its prefix added there, or its
 * CloudFront URLs answer 403.
 */
export const PUBLIC_IMAGE_SECTIONS: readonly ImageSection[] = [
	ImageSectionEnum.PRODUCT,
	ImageSectionEnum.PRODUCT_VARIANT,
	ImageSectionEnum.ARTICLE,
];

export function isPublicImageSection(section: unknown): boolean {
	return PUBLIC_IMAGE_SECTIONS.includes(section as ImageSection);
}

/**
 * The object key an S3 `path` names - `<section>/<entity_id>/<name>.<ext>`, as
 * `S3StorageService.upload` builds the URL. `null` when the path is not a URL.
 */
export function s3KeyFromPath(path: string): string | null {
	try {
		return decodeURIComponent(new URL(path).pathname.replace(/^\//, ''));
	} catch {
		return null;
	}
}

/**
 * The permission an image's section is gated by.
 *
 * Both image routes decide what to check from the section alone - the upload route reads it off
 * the form data, and the S3 view route recovers it from the object key, which is built as
 * `<section>/<entity_id>/<uuid>`. Most sections are named after a permission entity and answer
 * for themselves.
 *
 * A variant is the exception: it is written under its *product's* permission, matching the
 * backend, where `ProductVariantPolicy` passes `ProductEntity.NAME` to its parent rather than
 * claiming an entity of its own - "a separate entry would be a second switch nobody remembers to
 * grant". Adding `product-variant` to `PermissionEntitiesSuggestions` instead would also mean
 * keeping a kebab-case permission and a snake_case section aligned by hand forever.
 *
 * `null` for anything that names no entity at all, which is what makes this a validity check as
 * well as a lookup: an unrecognized section must not reach a permission call.
 */
export function imagePermissionEntity(
	section: unknown,
): PermissionEntityType | null {
	if (typeof section !== 'string') {
		return null;
	}

	if (section === ImageSectionEnum.PRODUCT_VARIANT) {
		return ImageSectionEnum.PRODUCT;
	}

	return PermissionEntitiesSuggestions.includes(
		section as PermissionEntityType,
	)
		? (section as PermissionEntityType)
		: null;
}

export const ImageTypeEnum = {
	LOGO: 'logo',
	GALLERY: 'gallery',
} as const;

export type ImageType = (typeof ImageTypeEnum)[keyof typeof ImageTypeEnum];

export const ImageStatusEnum = {
	ACTIVE: 'active',
	INACTIVE: 'inactive',
} as const;

export type ImageStatus =
	(typeof ImageStatusEnum)[keyof typeof ImageStatusEnum];

export const ImageStorageEnum = {
	LOCAL: 'local',
	S3: 's3',
} as const;

export type ImageStorage =
	(typeof ImageStorageEnum)[keyof typeof ImageStorageEnum];

export type ImageContentType = {
	language: string;
	title?: string;
	description?: string;
};

// Full image model with relations
export type ImageModel<D = Date | string> = {
	id: number;
	section: ImageSection;
	entity_id: number;
	image_type: ImageType;
	storage: ImageStorage;
	path: string;
	properties: ImagePropertiesType;
	status: ImageStatus;
	sort_order: number;

	// Timestamps
	created_at: D;
	updated_at: D;

	// Content translations
	contents: ImageContentType[];
};

// Helpers
export function getImageProperty(
	image: ImageModel,
	key: keyof ImagePropertiesType,
) {
	if (image.properties?.[key]) {
		return image.properties?.[key];
	}
}

export function getImageContent(
	image: ImageModel,
	language: Language,
): ImageContentType | undefined {
	if (!image.contents) {
		return;
	}

	const contentSelected = image.contents.find((c) => c.language === language);

	if (contentSelected) {
		return contentSelected;
	}

	const contentDefault = image.contents.find(
		(c) => c.language === Configuration.defaultLanguage(),
	);

	if (contentDefault) {
		return contentDefault;
	}

	const contentFirst = image.contents[0];

	if (contentFirst) {
		return contentFirst;
	}
}

export const displayImageLabel = (m: ImageModel) => {
	return `${m.path}`;
};

/**
 * The route that signs a private-bucket object and redirects to it.
 *
 * Exported so a renderer can recognize a `src` pointing here: such a `src` cannot go through
 * next/image's optimizer (see `isOptimizableImageSrc`).
 */
export const IMAGE_VIEW_ROUTE = '/api/image/view';

/**
 * The `src` to render a stored image from.
 *
 * Local files are served statically by Next straight off `/public`. S3 objects live in a
 * private bucket:
 *
 * - **Public sections** render from the CloudFront distribution in front of it - a stable,
 *   cacheable URL that `next/image` can optimize (`images.remotePatterns` in `next.config.ts`).
 * - **Everything else**, and every S3 image while no distribution is configured, points at
 *   `IMAGE_VIEW_ROUTE`, which authorizes the request and redirects to a presigned URL. Minting
 *   one cannot happen here - this function is synchronous and runs inside client components.
 */
export function showImage(path: string, storage?: ImageStorage) {
	if (storage === ImageStorageEnum.LOCAL) {
		return `${Configuration.get('images.local.view')}/${path}`;
	}

	const cdnUrl = Configuration.get('images.s3.cdnUrl');
	const key = cdnUrl ? s3KeyFromPath(path) : null;

	if (key && isPublicImageSection(key.split('/')[0])) {
		return `${cdnUrl}/${key}`;
	}

	const params = new URLSearchParams({
		path,
		storage: storage ?? ImageStorageEnum.S3,
	});

	return `${IMAGE_VIEW_ROUTE}?${params.toString()}`;
}

/**
 * Whether a `src` can be served through next/image's optimizer.
 *
 * Four shapes cannot:
 * - `blob:`/`data:` carry their bytes in the browser, and the optimizer refetches `src`
 *   server-side, so it has nothing to resolve.
 * - `IMAGE_VIEW_ROUTE` is fetched by the optimizer through an internal mocked request that
 *   carries no cookies, so the route's permission gate sees an anonymous caller and answers
 *   403; and even authorized it answers a 307 to S3, whose empty body the optimizer rejects
 *   as `"url" parameter is valid but internal response is invalid`. Either way the optimizer
 *   returns 400 and the image is broken - verified against the running server.
 *
 * - SVG, which the optimizer refuses - see the check below.
 *
 * Serving these raw costs nothing: a staged preview is a local file that never leaves the
 * tab, and an S3 object is already delivered by the bucket rather than by this app.
 */
export function isOptimizableImageSrc(src: string) {
	return !(
		src.startsWith('blob:') ||
		src.startsWith('data:') ||
		src.startsWith(IMAGE_VIEW_ROUTE) ||
		/*
		 * The optimizer refuses SVG unless `dangerouslyAllowSVG` is on, which would let an
		 * uploaded SVG run script on this origin. Uploads name the file after the MIME
		 * subtype, so an SVG ends in `.svg+xml` rather than `.svg` - and next/image's own
		 * `.svg` bypass does not catch it. Vectors need no resizing anyway.
		 */
		/\.svg(\+xml)?$/i.test(src.split('?')[0])
	);
}
