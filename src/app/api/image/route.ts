import { type NextRequest, NextResponse } from 'next/server';
import { Configuration } from '@/config/settings.config';
import { logger } from '@/helpers/logger.helper';
import { hasPermission } from '@/models/account.model';
import {
	type ImageStorage,
	ImageStorageEnum,
	imagePermissionEntity,
} from '@/models/image.model';
import type {
	PermissionEntityType,
	PermissionOperationType,
} from '@/models/permission.model';
import { getAuth } from '@/services/auth.service';
import { imageStorage } from '@/services/image-storage.service';
import { ImageMimeEnum } from '@/types/image.type';

export const runtime = 'nodejs';

const ACCEPTED_MIME_TYPES = Object.values(ImageMimeEnum) as string[];

function isValidStorage(value: unknown): value is ImageStorage {
	return (
		typeof value === 'string' &&
		Object.values(ImageStorageEnum).includes(value as ImageStorage)
	);
}

async function requirePermission(
	section: PermissionEntityType,
	operation: PermissionOperationType,
): Promise<boolean> {
	const authResponse = await getAuth();
	const auth = authResponse?.success ? (authResponse.data ?? null) : null;

	return hasPermission(auth, section, operation);
}

export async function POST(request: NextRequest) {
	const formData = await request.formData();

	const file = formData.get('file');
	const section = formData.get('section');
	const entity_id = Number(formData.get('entity_id'));

	if (!(file instanceof File)) {
		return NextResponse.json({ error: 'Missing file' }, { status: 400 });
	}

	/*
	 * The section names the gallery's owner; the permission it is gated by is a separate
	 * question, because a variant's images are written under its product's - see
	 * `imagePermissionEntity`. `null` covers both an unknown section and a non-string one, so
	 * nothing unrecognized reaches the permission call or the storage key.
	 */
	const permissionEntity = imagePermissionEntity(section);

	if (typeof section !== 'string' || !permissionEntity) {
		return NextResponse.json({ error: 'Invalid section' }, { status: 400 });
	}

	if (!Number.isInteger(entity_id) || entity_id <= 0) {
		return NextResponse.json(
			{ error: 'Invalid entity_id' },
			{ status: 400 },
		);
	}

	// Check permissions
	if (!(await requirePermission(permissionEntity, 'update'))) {
		return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	}

	if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
		return NextResponse.json(
			{ error: 'Unsupported file type' },
			{ status: 415 },
		);
	}

	const maxSize = Configuration.get('images.maxSizeBytes');

	if (file.size > maxSize) {
		return NextResponse.json({ error: 'File too large' }, { status: 413 });
	}

	try {
		const result = await imageStorage.upload(file, section, entity_id);

		return NextResponse.json(result);
	} catch (error) {
		logger.error('Image upload failed', error, { section, entity_id });

		return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
	}
}

/**
 * Removes a stored file. The image row is deleted separately, against the backend, before this
 * is called - see `removeImageFile`.
 *
 * The section the permission is checked against is read off the key, not taken from the
 * caller: a client-named section would let `article.update` authorize deleting a product's
 * file. `image.delete` (the dashboard's image list) or the owning section's `update` (the image
 * manager on that entity's form) each authorize it, matching the two places a delete starts.
 */
export async function DELETE(request: NextRequest) {
	const body = (await request.json().catch(() => null)) as {
		path?: unknown;
		storage?: unknown;
	} | null;

	const filePath = body?.path;
	const storage = body?.storage;

	if (typeof filePath !== 'string' || !isValidStorage(storage)) {
		return NextResponse.json(
			{ error: 'Missing or invalid path/storage' },
			{ status: 400 },
		);
	}

	let key: string | null;

	try {
		key = imageStorage.resolveKey(filePath, storage);
	} catch (error) {
		// The storage named is not configured here (e.g. `s3` without a bucket).
		logger.error('Image storage unavailable', error, { storage });

		return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
	}

	const permissionEntity = key
		? imagePermissionEntity(key.split('/')[0])
		: null;

	if (!key || !permissionEntity) {
		return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
	}

	const authResponse = await getAuth();
	const auth = authResponse?.success ? (authResponse.data ?? null) : null;

	if (
		!hasPermission(auth, 'image', 'delete') &&
		!hasPermission(auth, permissionEntity, 'update')
	) {
		return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	}

	try {
		await imageStorage.delete(filePath, storage);

		return NextResponse.json({ success: true });
	} catch (error) {
		logger.error('Image delete failed', error, { key, storage });

		return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
	}
}
