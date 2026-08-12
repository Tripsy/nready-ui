import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/helpers/logger.helper';
import { hasPermission } from '@/models/auth.model';
import { type ImageStorage, ImageStorageEnum } from '@/models/image.model';
import {
	PermissionEntitiesSuggestions,
	type PermissionEntityType,
} from '@/models/permission.model';
import { getAuth } from '@/services/auth.service';
import { imageStorage } from '@/services/image-storage.service';

export const runtime = 'nodejs';

/**
 * Resolves a stored image path to a URL the browser can actually fetch.
 *
 * The uploads bucket is private, so objects are reachable only through a presigned URL.
 * Minting one needs AWS credentials and is asynchronous, neither of which is available in
 * the client components that render images — `showImage()` is called inline during render.
 * This route is the seam: `showImage()` returns a link here, and here we authorize the
 * caller and redirect to a short-lived signed URL.
 *
 * Redirecting rather than streaming the bytes is deliberate. Proxying every image through
 * Node would put the full transfer on a 2 GB instance that is also running the API,
 * Postgres and Redis; a 307 hands the transfer to S3 and costs us one signature.
 */

// The upload key is built as `<section>/<entity_id>/<uuid>.<ext>` by
// `S3StorageService.generateKey`, so the section — and therefore the permission to check —
// is recoverable from the path itself.
function sectionFromKey(key: string): PermissionEntityType | null {
	const candidate = key.split('/')[0];

	return PermissionEntitiesSuggestions.includes(
		candidate as PermissionEntityType,
	)
		? (candidate as PermissionEntityType)
		: null;
}

function isValidStorage(value: unknown): value is ImageStorage {
	return (
		typeof value === 'string' &&
		Object.values(ImageStorageEnum).includes(value as ImageStorage)
	);
}

export async function GET(request: NextRequest) {
	const path = request.nextUrl.searchParams.get('path');
	const storage = request.nextUrl.searchParams.get('storage');

	if (!path) {
		return NextResponse.json({ error: 'Missing path' }, { status: 400 });
	}

	if (!isValidStorage(storage)) {
		return NextResponse.json({ error: 'Invalid storage' }, { status: 400 });
	}

	// Local files are served straight off /public by Next and never reach this route; a
	// request for one is a caller mistake rather than something to sign.
	if (storage === ImageStorageEnum.LOCAL) {
		return NextResponse.json(
			{ error: 'Local images are served statically' },
			{ status: 400 },
		);
	}

	let key: string;

	try {
		key = decodeURIComponent(new URL(path).pathname.replace(/^\//, ''));
	} catch {
		return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
	}

	const section = sectionFromKey(key);

	if (!section) {
		return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
	}

	const authResponse = await getAuth();
	const auth = authResponse?.success ? (authResponse.data ?? null) : null;

	// Same gate the rest of the section is behind: someone who cannot read a CMR record
	// must not be able to read its scanned documents by hitting this route directly.
	if (!hasPermission(auth, section, 'read')) {
		return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	}

	try {
		const signedUrl = await imageStorage.resolveUrl(path, storage);

		// 307 rather than 302: the signed URL expires, so a permanent or cacheable redirect
		// would leave browsers and proxies replaying a dead link.
		const response = NextResponse.redirect(signedUrl, 307);

		response.headers.set('Cache-Control', 'private, no-store, max-age=0');

		return response;
	} catch (error) {
		logger.error('Failed to sign image URL', error, { key });

		return NextResponse.json(
			{ error: 'Could not resolve image' },
			{ status: 500 },
		);
	}
}
