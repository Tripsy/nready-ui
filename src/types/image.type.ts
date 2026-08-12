export const ImageMimeEnum = {
	JPEG: 'image/jpeg',
	PNG: 'image/png',
	GIF: 'image/gif',
	WEBP: 'image/webp',
	SVG: 'image/svg+xml',
} as const;

export type ImageMime = (typeof ImageMimeEnum)[keyof typeof ImageMimeEnum];

export type ImagePropertiesType = {
	width?: number; // pixel
	height?: number; // pixel
	size?: number; // in bytes
	mime?: ImageMime;
};
