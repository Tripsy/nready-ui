import { type NextRequest, NextResponse } from 'next/server';
import { Configuration } from '@/config/settings.config';
import { logger } from '@/helpers/logger.helper';
import { hasPermission } from '@/models/auth.model';
import { type ImageStorage, ImageStorageEnum } from '@/models/image.model';
import {
	PermissionEntitiesSuggestions,
	type PermissionEntityType,
	type PermissionOperationType,
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

function isValidSection(value: unknown): value is PermissionEntityType {
	return (
		typeof value === 'string' &&
		Object.values(PermissionEntitiesSuggestions).includes(
			value as PermissionEntityType,
		)
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

	if (!isValidSection(section)) {
		return NextResponse.json({ error: 'Invalid section' }, { status: 400 });
	}

	if (!Number.isInteger(entity_id) || entity_id <= 0) {
		return NextResponse.json(
			{ error: 'Invalid entity_id' },
			{ status: 400 },
		);
	}

	// Check permissions
	if (!(await requirePermission(section, 'update'))) {
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

export async function DELETE(request: NextRequest) {
	const {
		path: filePath,
		storage,
		section,
	} = (await request.json()) as {
		path: string;
		storage: ImageStorage;
		section: string;
	};

	if (!filePath || !isValidStorage(storage) || !section) {
		return NextResponse.json(
			{ error: 'Missing or invalid path/storage/section' },
			{ status: 400 },
		);
	}

	if (!isValidSection(section)) {
		return NextResponse.json({ error: 'Invalid section' }, { status: 400 });
	}

	if (!(await requirePermission(section, 'update'))) {
		return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	}

	try {
		await imageStorage.delete(filePath, storage);

		return NextResponse.json({ success: true });
	} catch (error) {
		logger.error('Image delete failed', error, { filePath, storage });

		return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
	}
}
