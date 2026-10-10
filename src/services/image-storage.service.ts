import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
	DeleteObjectCommand,
	GetObjectCommand,
	PutObjectCommand,
	S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Configuration } from '@/config/settings.config';
import { type ImageStorage, ImageStorageEnum } from '@/models/image.model';

export interface ImageStorageService {
	upload(
		file: File,
		section: string,
		entity_id: number,
	): Promise<{ path: string; storage: ImageStorage }>;
	delete(filePath: string): Promise<void>;
	getStorageType(): ImageStorage;

	/**
	 * The storage key a stored `path` names, as `<section>/<entity_id>/<uuid>.<ext>` - or `null`
	 * when the path is not one this storage could have written.
	 *
	 * This is the gate for anything that acts on a client-supplied path: the key's leading
	 * segment is the section the caller's permission is checked against, so a path that does
	 * not parse to a well-formed key must not reach `delete`.
	 */
	resolveKey(filePath: string): string | null;

	/**
	 * A URL the browser can fetch the object from.
	 *
	 * For local storage this is the static path Next already serves. For S3 the bucket is
	 * private, so this mints a short-lived presigned URL - which is why the method is async
	 * even though one implementation has nothing to await.
	 */
	resolveUrl(filePath: string): Promise<string>;
}

// Long enough to survive a slow page load and an image retry, short enough that a URL
// leaking through a referrer header or a screenshot is worthless by the time anyone tries
// it. The browser caches the fetched bytes, not the signature, so this is not a per-render
// cost for the user.
const SIGNED_URL_TTL_SECONDS = 300;

/*
 * `<section>/<entity_id>/<name>.<ext>`. Uploads name the file with a `randomUUID()` and the MIME
 * subtype (`jpeg`, `svg+xml`); the backend's `image.seed.ts` files rows as `cover.jpg`, so the
 * name is any plain stem rather than a uuid. Anchored, with no `.` or `/` allowed outside the
 * single extension separator, so no accepted key can climb out of its section directory.
 */
const IMAGE_KEY_PATTERN = /^[a-z_]+\/\d+\/[A-Za-z0-9_-]+\.[a-z0-9+]+$/;

function getBaseStoragePath() {
	return path.join(process.cwd(), Configuration.get('images.local.save'));
}

class S3StorageService implements ImageStorageService {
	private client: S3Client;
	private readonly bucket: string;
	private readonly region: string;

	constructor() {
		this.bucket = Configuration.get('images.s3.bucket');
		this.region = Configuration.get('aws.region');

		if (!this.bucket) {
			throw new Error('AWS_S3_BUCKET is not configured');
		}

		const accessKeyId = Configuration.get('aws.accessKeyId');
		const secretAccessKey = Configuration.get('aws.secretAccessKey');

		/*
		 * Credentials are passed only when both are actually configured. Omitting the key
		 * lets the SDK fall back to its default provider chain, which on EC2 resolves the
		 * instance role from IMDS - so production needs no long-lived access keys on disk.
		 *
		 * The config defaults both to '', and passing those through would not fall back:
		 * an explicit `credentials` object short-circuits the chain and every request would
		 * fail to sign. Hence the check rather than passing the values straight down.
		 */
		this.client = new S3Client({
			region: this.region,
			...(accessKeyId && secretAccessKey
				? { credentials: { accessKeyId, secretAccessKey } }
				: {}),
		});
	}

	async upload(
		file: File,
		section: string,
		entity_id: number,
	): Promise<{ path: string; storage: ImageStorage }> {
		const key = this.generateKey(section, entity_id, file.type);
		const buffer = Buffer.from(await file.arrayBuffer());

		await this.client.send(
			new PutObjectCommand({
				Bucket: this.bucket,
				Key: key,
				Body: buffer,
				ContentType: file.type,
				/*
				 * Keys end in a fresh `randomUUID()`, so an object's bytes never change under
				 * its URL - CloudFront and browsers may keep it for good. A replaced image is a
				 * new key, never an overwrite.
				 */
				CacheControl: 'public, max-age=31536000, immutable',
			}),
		);

		const path = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
		return { path, storage: ImageStorageEnum.S3 };
	}

	async delete(filePath: string): Promise<void> {
		const key = this.resolveKey(filePath);

		if (!key) {
			throw new Error('Invalid S3 path');
		}

		await this.client.send(
			new DeleteObjectCommand({
				Bucket: this.bucket,
				Key: key,
			}),
		);
	}

	async resolveUrl(filePath: string): Promise<string> {
		const key = this.resolveS3Key(filePath);

		if (!key) {
			throw new Error('Invalid S3 path');
		}

		return getSignedUrl(
			this.client,
			new GetObjectCommand({ Bucket: this.bucket, Key: key }),
			{ expiresIn: SIGNED_URL_TTL_SECONDS },
		);
	}

	getStorageType(): ImageStorage {
		return ImageStorageEnum.S3;
	}

	/**
	 * Stricter than `resolveS3Key`: the URL must name this bucket's host, exactly as `upload`
	 * builds it. `resolveS3Key` reads the pathname alone, so any host would map onto a key in
	 * this bucket - acceptable for signing a read, not for a delete.
	 */
	resolveKey(filePath: string): string | null {
		let url: URL;

		try {
			url = new URL(filePath);
		} catch {
			return null;
		}

		if (
			url.protocol !== 'https:' ||
			url.host !== `${this.bucket}.s3.${this.region}.amazonaws.com`
		) {
			return null;
		}

		const key = this.resolveS3Key(filePath);

		return key && IMAGE_KEY_PATTERN.test(key) ? key : null;
	}

	private generateKey(
		section: string,
		entity_id: number,
		fileType: string,
	): string {
		const extension = fileType.split('/')[1] || 'bin';

		return `${section}/${entity_id}/${randomUUID()}.${extension}`;
	}

	private resolveS3Key(url: string): string | null {
		try {
			return decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
		} catch {
			return null;
		}
	}
}

class LocalStorageService implements ImageStorageService {
	private readonly baseStoragePath: string;

	constructor() {
		this.baseStoragePath = getBaseStoragePath();
	}

	private generateFilePath(
		section: string,
		entity_id: number,
		fileType: string,
	): string {
		const extension = fileType.split('/')[1] || 'bin';

		return `${section}/${entity_id}/${randomUUID()}.${extension}`;
	}

	async upload(
		file: File,
		section: string,
		entity_id: number,
	): Promise<{ path: string; storage: ImageStorage }> {
		const buffer = Buffer.from(await file.arrayBuffer());

		const filePath = this.generateFilePath(section, entity_id, file.type);
		const fileDir = path.dirname(filePath);

		await mkdir(path.join(this.baseStoragePath, fileDir), {
			recursive: true,
		});
		await writeFile(path.join(this.baseStoragePath, filePath), buffer);

		return {
			path: filePath,
			storage: ImageStorageEnum.LOCAL,
		};
	}

	async delete(filePath: string): Promise<void> {
		const key = this.resolveKey(filePath);

		if (!key) {
			throw new Error('Invalid local path');
		}

		const fileStoragePath = path.join(this.baseStoragePath, key);

		// Second line behind the key pattern, which already rules out traversal. The separator
		// matters: a bare prefix check would accept a sibling such as `uploads-old/`.
		if (!fileStoragePath.startsWith(this.baseStoragePath + path.sep)) {
			throw new Error('Invalid local path');
		}

		await unlink(fileStoragePath).catch((error: NodeJS.ErrnoException) => {
			if (error.code !== 'ENOENT') {
				throw error;
			}
		});
	}

	async resolveUrl(filePath: string): Promise<string> {
		return `${Configuration.get('images.local.view')}/${filePath}`;
	}

	getStorageType(): ImageStorage {
		return ImageStorageEnum.LOCAL;
	}

	// The stored path is the key itself, relative to `baseStoragePath`.
	resolveKey(filePath: string): string | null {
		return IMAGE_KEY_PATTERN.test(filePath) ? filePath : null;
	}
}

export class ImageStorageFactory {
	private static instance: ImageStorageFactory;
	private services: Map<ImageStorage, ImageStorageService> = new Map();

	private constructor() {}

	static getInstance(): ImageStorageFactory {
		if (!ImageStorageFactory.instance) {
			ImageStorageFactory.instance = new ImageStorageFactory();
		}

		return ImageStorageFactory.instance;
	}

	getService(storageType: ImageStorage): ImageStorageService {
		if (this.services.has(storageType)) {
			return this.services.get(storageType) as ImageStorageService;
		}

		let service: ImageStorageService;

		switch (storageType) {
			case ImageStorageEnum.S3:
				service = new S3StorageService();
				break;
			case ImageStorageEnum.LOCAL:
				service = new LocalStorageService();
				break;
			default:
				throw new Error(`Unsupported storage type: ${storageType}`);
		}

		this.services.set(storageType, service);

		return service;
	}

	getDefaultService(): ImageStorageService {
		// Cast rather than typing `images.storage` in the config: `ImageStorage` lives in
		// image.model.ts, which itself reads Configuration - importing it there would close
		// a cycle (Biome's noImportCycles).
		const storageType = Configuration.get('images.storage') as ImageStorage;

		return this.getService(storageType);
	}
}

export const imageStorage = {
	upload: async (
		file: File,
		section: string,
		entity_id: number,
	): Promise<{ path: string; storage: ImageStorage }> => {
		const service = ImageStorageFactory.getInstance().getDefaultService();

		return service.upload(file, section, entity_id);
	},
	delete: async (filePath: string, storage: ImageStorage): Promise<void> => {
		const service = ImageStorageFactory.getInstance().getService(storage);

		return service.delete(filePath);
	},
	resolveKey: (filePath: string, storage: ImageStorage): string | null => {
		const service = ImageStorageFactory.getInstance().getService(storage);

		return service.resolveKey(filePath);
	},
	resolveUrl: async (
		filePath: string,
		storage: ImageStorage,
	): Promise<string> => {
		const service = ImageStorageFactory.getInstance().getService(storage);

		return service.resolveUrl(filePath);
	},
};
