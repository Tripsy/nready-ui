import { Configuration } from '@/config/settings.config';
import type { Language } from '@/types/common.type';
import type { ImagePropertiesType } from '@/types/image.type';

export const ImageSectionEnum = {
	PRODUCT: 'product',
	CATEGORY: 'category',
	BRAND: 'brand',
	ARTICLE: 'article',
} as const;

export type ImageSection =
	(typeof ImageSectionEnum)[keyof typeof ImageSectionEnum];

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
 * private bucket and are only reachable through a presigned URL, which cannot be minted
 * here — this function is synchronous and runs inside client components. So S3 paths point
 * at `IMAGE_VIEW_ROUTE`, which authorizes the request and redirects to a signed URL.
 */
export function showImage(path: string, storage?: ImageStorage) {
	if (storage === ImageStorageEnum.LOCAL) {
		return `${Configuration.get('images.local.view')}/${path}`;
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
 * Three shapes cannot:
 * - `blob:`/`data:` carry their bytes in the browser, and the optimizer refetches `src`
 *   server-side, so it has nothing to resolve.
 * - `IMAGE_VIEW_ROUTE` is fetched by the optimizer through an internal mocked request that
 *   carries no cookies, so the route's permission gate sees an anonymous caller and answers
 *   403; and even authorized it answers a 307 to S3, whose empty body the optimizer rejects
 *   as `"url" parameter is valid but internal response is invalid`. Either way the optimizer
 *   returns 400 and the image is broken — verified against the running server.
 *
 * Serving these raw costs nothing: a staged preview is a local file that never leaves the
 * tab, and an S3 object is already delivered by the bucket rather than by this app.
 */
export function isOptimizableImageSrc(src: string) {
	return !(
		src.startsWith('blob:') ||
		src.startsWith('data:') ||
		src.startsWith(IMAGE_VIEW_ROUTE)
	);
}
