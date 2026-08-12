'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icons } from '@/components/icon.component';
import { SortableList } from '@/components/sortable-list.component';
import {
	ErrorComponent,
	LoadingComponent,
} from '@/components/status.component';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import Routes from '@/config/routes.setup';
import { Configuration } from '@/config/settings.config';
import { getLanguageClient } from '@/config/translate.setup';
import { ApiError } from '@/exceptions/api.error';
import ValueError from '@/exceptions/value.error';
import { CSRF_HEADER, getCsrfToken } from '@/helpers/csrf.helper';
import { cn } from '@/helpers/css.helper';
import { displayImage } from '@/helpers/display.helper';
import { getErrorMessage } from '@/helpers/error.helper';
import {
	requestDelete,
	requestFind,
	requestUpdate,
	requestUpdateStatus,
} from '@/helpers/services.helper';
import { formatBytes, formatMime, replaceVars } from '@/helpers/string.helper';
import { useConfirmationDialog } from '@/hooks/use-confirmation-dialog';
import { useTranslation } from '@/hooks/use-translation.hook';
import {
	type ImageContentType,
	type ImageModel,
	type ImageSection,
	type ImageStatus,
	ImageStatusEnum,
	type ImageStorage,
	type ImageType,
	ImageTypeEnum,
	showImage,
} from '@/models/image.model';
import { useToast } from '@/providers/toast.provider';
import {
	createImage,
	orderUpdate,
	removeImageFile,
} from '@/services/image.service';
import type { Language } from '@/types/common.type';
import {
	type ImageMime,
	ImageMimeEnum,
	type ImagePropertiesType,
} from '@/types/image.type';

// Types

type ManagerMode = 'view' | 'edit';

export type ImageEntrySituation =
	| 'existing' // from BE, no changes
	| 'existing_dirty' // from BE, attributes edited
	| 'staged' // new, not yet saved
	| 'uploading' // file upload to FE server in progress
	| 'saving' // BE record creation in progress
	| 'error';

export type ImageEntry = {
	key: string;
	situation: ImageEntrySituation;

	image_type: ImageType;
	path: string;
	properties: ImagePropertiesType;
	contents: Partial<Record<Language, ImageContentType>>;
	sort_order: number;
	status?: ImageStatus;

	// Set only for entries recorded in DB
	id?: number; // Database `id`
	storage?: ImageStorage;

	// Only for staged images
	file?: File;
};

type AttributeFieldName = keyof Omit<ImageContentType, 'language'>;
type AttributeFieldRequirement = 'required' | 'optional';

export type AttributeFieldsConfig = Partial<
	Record<AttributeFieldName, AttributeFieldRequirement>
>;

type ValidationErrors = Record<string, string[]>;

// Constants

const GALLERY_MAX = 5;
const ACCEPTED_MIME_TYPES = Object.values(ImageMimeEnum);
const ACCEPTED_EXTENSIONS = ACCEPTED_MIME_TYPES.join(',');
const ACCEPTED_EXTENSIONS_DESC = 'JPEG, PNG, WebP, SVG, GIF';
const DEFAULT_LANGUAGE = Configuration.get('language.default');

// Fixed display order — independent of key order in whatever config object gets passed in
const ATTRIBUTE_FIELD_ORDER: AttributeFieldName[] = ['title', 'description'];

// Helpers

function determineImageName(image: ImageEntry): string {
	if (image.file) {
		return image.file.name;
	}

	return image.path.split('/').pop() || 'unnamed';
}

async function readImageProperties(file: File): Promise<ImagePropertiesType> {
	return new Promise((resolve) => {
		const url = URL.createObjectURL(file);

		const img = document.createElement('img');

		img.onload = () => {
			resolve({
				mime: file.type as ImageMime,
				size: file.size,
				width: img.naturalWidth,
				height: img.naturalHeight,
			});

			URL.revokeObjectURL(url);
		};

		img.onerror = () => {
			resolve({
				mime: file.type as ImageMime,
				size: file.size,
			});

			URL.revokeObjectURL(url);
		};

		img.src = url;
	});
}

async function buildImageEntry(
	file: File,
	image_type: ImageType,
): Promise<ImageEntry> {
	const properties = await readImageProperties(file);

	return {
		key: `${file.name}-${file.size}-${file.lastModified}`,
		situation: 'staged',
		image_type,
		path: URL.createObjectURL(file),
		properties,
		contents: {
			[getLanguageClient()]: {
				title: '',
				description: '',
			},
		},
		sort_order: 0,
		file,
	};
}

function normalizeExistingImage(model: ImageModel): ImageEntry {
	return {
		key: `image-entry-${model.id}`,
		id: model.id,
		situation: 'existing',
		image_type: model.image_type,
		storage: model.storage,
		path: model.path,
		properties: model.properties,
		sort_order: model.sort_order ?? 0,
		status: model.status,
		contents: Object.fromEntries(
			model.contents.map((c) => [
				c.language,
				{
					title: c.title ?? '',
					description: c.description ?? '',
				},
			]),
		) as Partial<Record<Language, ImageContentType>>,
	};
}

function getConfiguredFields(
	attributeFields: AttributeFieldsConfig,
): AttributeFieldName[] {
	return ATTRIBUTE_FIELD_ORDER.filter((field) => attributeFields[field]);
}

function isFieldRequired(
	attributeFields: AttributeFieldsConfig,
	field: AttributeFieldName,
): boolean {
	return attributeFields[field] === 'required';
}

function buildContentsPayload(
	entry: ImageEntry,
	attributeFields: AttributeFieldsConfig,
) {
	const configuredFields = getConfiguredFields(attributeFields);

	return Object.entries(entry.contents)
		.filter(([, c]) => configuredFields.some((field) => c?.[field]?.trim()))
		.map(([language, c]) => {
			const payload: Record<string, string | null> = { language };

			for (const field of configuredFields) {
				payload[field] = c?.[field]?.trim() || null;
			}

			return payload;
		});
}

function withUpdatedOrder(entries: ImageEntry[]): ImageEntry[] {
	return entries.map((e, i) => ({ ...e, sort_order: entries.length - i }));
}

function PropertyBadge({ label, value }: { label: string; value: string }) {
	return (
		<span className="text-xs text-muted">
			<span className="font-medium text-foreground/60">{label}:</span>{' '}
			{value}
		</span>
	);
}

// Components

function AttributeField({
	mode,
	label,
	value,
	onChange,
}: {
	mode: ManagerMode;
	label: string;
	value: string;
	onChange: (v: string) => void;
}) {
	return (
		<div className="flex items-center gap-2">
			<label
				htmlFor={`attribute-${label}`}
				className="text-xs font-medium text-muted w-20 shrink-0"
			>
				{label}
			</label>
			<input
				type="text"
				value={value}
				disabled={mode === 'view'}
				id={`attribute-${label}`}
				onChange={(e) => onChange(e.target.value)}
				className={cn(
					'w-64 shrink-0',
					'rounded-md border border-border bg-background px-3 py-1.5',
					'text-sm text-foreground',
					'focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/20',
					'transition-colors',
					mode === 'view' && 'w-full border-none px-0 bg-transparent',
				)}
			/>
		</div>
	);
}

type ImageCardBaseProps = {
	entry: ImageEntry;
	language: Language;
	attributeFields: AttributeFieldsConfig;
	errors: string[];
};

type ImageCardViewProps = ImageCardBaseProps & {
	mode: 'view';
	onRemove?: () => void;
	onContentChange?: (
		language: Language,
		field: keyof Omit<ImageContentType, 'language'>,
		value: string,
	) => void;
	onStatusChange?: () => void;
};

type ImageCardEditProps = ImageCardBaseProps & {
	mode: 'edit';
	onRemove: () => void;
	onContentChange: (
		language: Language,
		field: keyof Omit<ImageContentType, 'language'>,
		value: string,
	) => void;
	onStatusChange: () => void;
};

type ImageCardProps = ImageCardViewProps | ImageCardEditProps;

function ImageCard({
	mode,
	entry,
	language,
	attributeFields,
	onRemove,
	onContentChange,
	onStatusChange,
	errors,
	dragButton,
}: ImageCardProps & {
	dragButton?: React.ReactNode;
}) {
	const { properties, contents } = entry;
	const attributes = contents[language];

	const fileName = determineImageName(entry);

	const configuredFields = getConfiguredFields(attributeFields);

	return (
		<div className="group rounded-lg border border-border bg-surface overflow-hidden shadow-sm">
			{/* Preview row */}
			<div className="flex items-start gap-3 p-3">
				<div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-border bg-surface-secondary/30">
					{displayImage({
						src: showImage(entry.path, entry.storage),
						alt: fileName,
					})}
				</div>

				<div className="min-w-0 flex-1">
					<p className="truncate text-sm font-medium text-surface-foreground">
						{fileName}
					</p>

					{/* Properties grid */}
					<div className="mt-1.5 flex gap-x-2 gap-y-1.5 flex-wrap">
						<PropertyBadge
							label="Type"
							value={formatMime(properties.mime)}
						/>
						<PropertyBadge
							label="Size"
							value={formatBytes(properties.size)}
						/>
						<PropertyBadge
							label="W"
							value={
								properties.width ? `${properties.width}px` : '—'
							}
						/>
						<PropertyBadge
							label="H"
							value={
								properties.height
									? `${properties.height}px`
									: '—'
							}
						/>
					</div>
				</div>

				{mode === 'edit' && (
					<div className="flex gap-4">
						{entry.status !== undefined && (
							<Button
								variant="ghost"
								onClick={onStatusChange}
								className={cn(
									'hover:scale-125',
									entry.status === ImageStatusEnum.ACTIVE &&
										'text-success hover:text-danger',
									entry.status === ImageStatusEnum.INACTIVE &&
										'text-danger hover:text-success',
								)}
								title={
									entry.status === ImageStatusEnum.ACTIVE
										? 'Deactivate'
										: 'Activate'
								}
							>
								<Icons.Status.Active />
							</Button>
						)}

						{dragButton}

						<Button
							variant="ghost"
							onClick={onRemove}
							className="text-muted/50 hover:scale-125 hover:text-danger"
							title="Remove image"
						>
							<Icons.Action.Delete />
						</Button>
					</div>
				)}

				{mode === 'view' && (
					<>
						{entry.status === ImageStatusEnum.ACTIVE && (
							<div title="Active image">
								<Icons.Status.Active className="text-success" />
							</div>
						)}
						{entry.status === ImageStatusEnum.INACTIVE && (
							<div title="Inactive image">
								<Icons.Status.Inactive className="text-danger" />
							</div>
						)}
					</>
				)}
			</div>

			{/* Attributes — only render if at least one field is configured */}
			{configuredFields.length > 0 && (
				<div className="border-t border-border bg-surface-secondary/30 px-3 pb-3 pt-2.5">
					<div className="flex flex-col gap-1.5">
						{configuredFields.map((field) => (
							<AttributeField
								key={field}
								mode={mode}
								label={
									field === 'title' ? 'Title' : 'Description'
								}
								value={attributes?.[field] ?? ''}
								onChange={(v) =>
									mode === 'edit' &&
									onContentChange(language, field, v)
								}
							/>
						))}
					</div>
				</div>
			)}

			{errors && errors.length > 0 && (
				<div className="text-sm dark:bg-danger-foreground text-danger p-2 inline-block">
					{errors.map((error) => (
						<div key={error}>{error}</div>
					))}
				</div>
			)}
		</div>
	);
}

function SortableImageCard(
	props: ImageCardProps & {
		disabled: boolean;
		isSortable: boolean; // Enable / disable drag and drop icon
	},
) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({
		id: props.entry.key,
		disabled: props.disabled || !props.isSortable,
	});

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
	};

	return (
		<div ref={setNodeRef} style={style}>
			<ImageCard
				{...props}
				dragButton={
					props.isSortable && (
						<Button
							variant="ghost"
							title="Change order"
							{...attributes}
							{...listeners}
							className="cursor-grab text-muted/40 active:cursor-grabbing hover:scale-125 hover:text-warning"
							aria-label="Drag to reorder"
						>
							<Icons.Action.Move />
						</Button>
					)
				}
			/>
		</div>
	);
}

function DropZone({
	label,
	subLabel,
	imageType,
	disabled = false,
	onFiles,
}: {
	label: string;
	subLabel: string;
	imageType: ImageType;
	disabled?: boolean;
	onFiles: (files: File[]) => void;
}) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [isDragOver, setIsDragOver] = useState(false);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			setIsDragOver(false);

			if (disabled) {
				return;
			}

			const files = Array.from(e.dataTransfer.files).filter((f) =>
				ACCEPTED_MIME_TYPES.includes(f.type as ImageMime),
			);

			if (files.length > 0) {
				onFiles(files);
			}
		},
		[disabled, onFiles],
	);

	const handleInputChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const files = Array.from(e.target.files ?? []);

			if (files.length > 0) {
				onFiles(files);
			}

			// Reset - so same file can be re-selected
			e.target.value = '';
		},
		[onFiles],
	);

	return (
		<button
			type="button"
			tabIndex={disabled ? -1 : 0}
			aria-label={`Upload ${label}`}
			aria-disabled={disabled}
			className={[
				'w-full flex flex-col items-center justify-center gap-2',
				'rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer',
				'select-none',
				isDragOver && !disabled
					? 'border-focus bg-accent/5'
					: disabled
						? 'border-border bg-surface-secondary/30 cursor-not-allowed'
						: 'border-border hover:border-focus hover:bg-surface-secondary/20',
			]
				.filter(Boolean)
				.join(' ')}
			onClick={() => !disabled && inputRef.current?.click()}
			onKeyDown={(e) => {
				if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
					e.preventDefault();
					inputRef.current?.click();
				}
			}}
			onDragOver={(e) => {
				e.preventDefault();
				if (!disabled) setIsDragOver(true);
			}}
			onDragLeave={() => setIsDragOver(false)}
			onDrop={handleDrop}
		>
			<input
				ref={inputRef}
				type="file"
				accept={ACCEPTED_EXTENSIONS}
				multiple={imageType === ImageTypeEnum.GALLERY}
				className="hidden"
				tabIndex={-1}
				onChange={handleInputChange}
			/>

			<div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-secondary text-muted">
				<Icons.Action.Upload />
			</div>

			<div className="text-center">
				<p className="text-sm font-medium text-surface-foreground">
					{label}
				</p>
				<p className="mt-0.5 text-xs text-muted">{subLabel}</p>
			</div>
		</button>
	);
}

export function ManagerImages({
	section,
	entity_id,
	types,
	permissions,
	attributeFields = {},
	attributeLanguages,
}: {
	section: ImageSection;
	entity_id: number;
	types: ImageType[];
	permissions: {
		edit: boolean;
	};
	attributeFields?: AttributeFieldsConfig;
	attributeLanguages?: Language[];
}) {
	const [mode, setMode] = useState<ManagerMode>('view');
	const { showToast } = useToast();
	const languages = attributeLanguages ?? [DEFAULT_LANGUAGE];

	const translationsKeys = [
		'app.error.title',
		'app.error.description',
		'app.success.title',
		'image.action.add.success',
		'image.validation.invalid_attribute',
		'image.error.save_failed',
		'image.success.save',
		'image.action.delete.title',
		'image.action.delete.success',
		'image.action.delete.confirm',
		'image.action.enable.title',
		'image.action.enable.confirm',
		'image.action.enable.success',
		'image.action.disable.title',
		'image.action.disable.confirm',
		'image.action.disable.success',
	] as const;

	const { translations } = useTranslation(translationsKeys);

	const queryClient = useQueryClient();

	const queryKeyImages = useMemo(
		() => ['images', section, entity_id],
		[section, entity_id],
	);

	const {
		data: images,
		isLoading: isLoadingImages,
		error: errorImages,
	} = useQuery({
		queryKey: queryKeyImages,
		queryFn: () =>
			requestFind<ImageModel>('image', {
				filter: {
					section: section,
					entity_id: entity_id,
				},
				order_by: 'sort_order',
				direction: 'DESC',
			}),
	});

	const invalidateImages = useCallback(
		() =>
			queryClient.invalidateQueries({
				queryKey: queryKeyImages,
			}),
		[queryClient, queryKeyImages],
	);

	const [activeLanguage, setActiveLanguage] = useState<Language>(
		getLanguageClient(),
	);
	const [saving, setSaving] = useState(false);
	const [errors, setErrors] = useState<ValidationErrors>({});

	const [logo, setLogo] = useState<ImageEntry | null>(null);
	const [gallery, setGallery] = useState<ImageEntry[]>([]);

	const [orderChanged, setOrderChanged] = useState(false);

	const { openDialog, dialogProps } = useConfirmationDialog();

	useEffect(() => {
		if (!images?.entries) {
			return;
		}

		setOrderChanged(false);

		if (types.includes(ImageTypeEnum.LOGO)) {
			const existingLogo = images.entries.find(
				(i) => i.image_type === ImageTypeEnum.LOGO,
			);

			setLogo((prev) => {
				if (prev?.situation === 'error') {
					return prev;
				}
				return existingLogo
					? normalizeExistingImage(existingLogo)
					: null;
			});
		}

		if (types.includes(ImageTypeEnum.GALLERY)) {
			const existingGallery = images.entries.filter(
				(i) => i.image_type === ImageTypeEnum.GALLERY,
			);

			setGallery((prev) => {
				const freshEntries = existingGallery.map(
					normalizeExistingImage,
				);
				const freshById = new Map(freshEntries.map((e) => [e.id, e]));

				const merged = prev
					.map((e) => {
						if (e.situation === 'error') {
							return e;
						}

						if (e.id && freshById.has(e.id)) {
							return freshById.get(e.id);
						}

						return null;
					})
					.filter(Boolean) as ImageEntry[];

				const mergedIds = new Set(
					merged.map((e) => e.id).filter(Boolean),
				);
				const newEntries = freshEntries.filter(
					(e) => !mergedIds.has(e.id),
				);

				return [...merged, ...newEntries];
			});
		}
	}, [images, types]);

	/**
	 * Triggers save for `staged` (eg: createEntry) and `existing_dirty` (eg: updateEntry) via button click && save image sort_order
	 */
	async function handleSave() {
		setSaving(true);
		setErrors({});

		const toSave = [...(logo ? [logo] : []), ...gallery].filter((e) =>
			['staged', 'existing_dirty'].includes(e.situation),
		);

		const requiredFields = getConfiguredFields(attributeFields).filter(
			(field) => isFieldRequired(attributeFields, field),
		);

		const validationErrors: ValidationErrors = {};

		for (const entry of toSave) {
			const content = entry.contents[DEFAULT_LANGUAGE];

			for (const field of requiredFields) {
				if (!content?.[field]?.trim()) {
					if (!validationErrors[entry.key]) {
						validationErrors[entry.key] = [];
					}

					validationErrors[entry.key].push(
						replaceVars(
							translations['image.validation.invalid_attribute'],
							{ attribute: field },
						),
					);
				}
			}
		}

		if (Object.keys(validationErrors).length > 0) {
			setErrors(validationErrors);
			setActiveLanguage(DEFAULT_LANGUAGE);
			setSaving(false);

			return;
		}

		const existingOrder = gallery
			.filter((e): e is ImageEntry & { id: number } => !!e.id)
			.map((e) => ({ id: e.id, sort_order: e.sort_order }));

		const savePromises: Promise<unknown>[] = [
			...toSave.map((entry) =>
				entry.situation === 'staged'
					? createEntry(entry)
					: updateEntry(entry),
			),
		];

		if (orderChanged && existingOrder.length >= 2) {
			savePromises.push(orderUpdate(section, entity_id, existingOrder));
		}

		const results = await Promise.allSettled(savePromises);

		const failedEntries = toSave.filter(
			(_, i) => results[i].status === 'rejected',
		);

		if (failedEntries.length > 0) {
			const entryErrors = Object.fromEntries(
				failedEntries.map((e) => [
					e.key,
					[translations['image.error.save_failed']],
				]),
			);

			setErrors(entryErrors); // This will replace all existing errors
		}

		const anySucceeded = results.some((r) => r.status === 'fulfilled');

		// Invalidate even on partial success — some entries may have saved correctly
		if (anySucceeded) {
			await invalidateImages();
		}

		setSaving(false);

		if (anySucceeded) {
			showToast({
				severity: 'success',
				summary: translations['app.success.title'],
				detail: translations['image.success.save'],
			});
		} else {
			showToast({
				severity: 'error',
				summary: translations['app.error.title'],
				detail: translations['image.error.save_failed'],
			});
		}
	}

	/**
	 * Triggers when gallery order is changed
	 * Update `ImageEntry` via `setGallery`
	 *
	 * @param reordered
	 */
	function handleOrder(reordered: ImageEntry[]) {
		const updated = withUpdatedOrder(reordered);

		setGallery(updated);

		if (updated.some((e) => e.id)) {
			setOrderChanged(true);
		}
	}

	/**
	 * Triggers when attributes (eg: title, description) are updated
	 * Update `ImageEntry` via `setLogo` OR `setGallery`
	 *
	 * @param key
	 * @param language
	 * @param field
	 * @param value
	 */
	function handleContentChange(
		key: string,
		language: Language,
		field: keyof Omit<ImageContentType, 'language'>,
		value: string,
	) {
		const update = (entry: ImageEntry): ImageEntry => ({
			...entry,
			situation:
				entry.situation === 'existing'
					? 'existing_dirty'
					: entry.situation,
			contents: {
				...entry.contents,
				[language]: {
					...entry.contents[language],
					[field]: value,
				},
			},
		});

		if (logo?.key === key) {
			setLogo((prev) => (prev ? update(prev) : null));

			return;
		}

		setGallery((prev) => prev.map((e) => (e.key === key ? update(e) : e)));
	}

	/**
	 * Triggers confirmation dialog
	 *
	 * @param entry
	 */
	function triggerRemove(entry: ImageEntry) {
		openDialog({
			title: replaceVars(translations['image.action.delete.title'], {
				entry: determineImageName(entry),
			}),
			description: translations['image.action.delete.confirm'],
			onConfirm: async () => {
				await handleRemove(entry);
			},
		});
	}

	/**
	 * Handle image remove depending on `image_type`.
	 * Based on `status` (eg: for `existing` && `existing_dirty`)
	 * triggers file remove on FE & request delete for BE)
	 *
	 * @param entry
	 */
	async function handleRemove(entry: ImageEntry) {
		try {
			await removeImage(entry);

			switch (entry.image_type) {
				case ImageTypeEnum.LOGO:
					setLogo(null);
					break;
				case ImageTypeEnum.GALLERY: {
					setGallery((prev) =>
						withUpdatedOrder(
							prev.filter((e) => e.key !== entry.key),
						),
					);
					break;
				}
			}

			showToast({
				severity: 'info',
				summary: translations['app.success.title'],
				detail: translations['image.action.delete.success'],
			});
		} catch (error) {
			showToast({
				severity: 'error',
				summary: translations['app.error.title'],
				detail: getErrorMessage(error),
			});
			return;
		}
	}

	/**
	 * Triggers confirmation dialog
	 *
	 * @param entry
	 */
	function triggerStatusChange(entry: ImageEntry) {
		const actionKey =
			entry.status === ImageStatusEnum.ACTIVE ? 'disable' : 'enable';

		openDialog({
			title: replaceVars(
				translations[`image.action.${actionKey}.title`],
				{
					entry: determineImageName(entry),
				},
			),
			description: translations[`image.action.${actionKey}.confirm`],
			onConfirm: async () => {
				await handleStatusChange(
					entry,
					entry.status === ImageStatusEnum.ACTIVE
						? ImageStatusEnum.INACTIVE
						: ImageStatusEnum.ACTIVE,
				);
			},
		});
	}

	async function handleStatusChange(entry: ImageEntry, status: ImageStatus) {
		try {
			if (!entry.id) {
				return;
			}

			const fetchResponse = await requestUpdateStatus(
				'image',
				{
					id: entry.id,
					status,
				},
				status,
			);

			if (fetchResponse?.success) {
				await invalidateImages();

				showToast({
					severity: 'success',
					summary: translations['app.success.title'],
					detail: fetchResponse?.message,
				});
			} else {
				showToast({
					severity: 'error',
					summary: translations['app.error.title'],
					detail: fetchResponse?.message,
				});
			}
		} catch (error) {
			showToast({
				severity: 'error',
				summary: 'Error',
				detail:
					error instanceof ValueError || error instanceof ApiError
						? error.message
						: translations['app.error.description'],
			});
		}
	}

	/**
	 * Handle logo image upload
	 */
	const handleLogoFiles = useCallback(
		async (files: File[]) => {
			const file = files[0];

			if (!file) {
				return;
			}

			if (logo) {
				URL.revokeObjectURL(logo.path);
			}

			const entry = await buildImageEntry(file, ImageTypeEnum.LOGO);

			setLogo(entry);

			showToast({
				severity: 'success',
				summary: translations['app.success.title'],
				detail: translations['image.action.add.success'],
			});
		},
		[logo, showToast, translations],
	);

	/**
	 * Handle gallery image upload
	 */
	const handleGalleryFiles = useCallback(
		async (files: File[]) => {
			const slots = GALLERY_MAX - gallery.length;

			if (slots <= 0) {
				return;
			}

			const accepted = files.slice(0, slots);
			const entries = await Promise.all(
				accepted.map((f) => buildImageEntry(f, ImageTypeEnum.GALLERY)),
			);

			setGallery((prev) => withUpdatedOrder([...prev, ...entries]));

			showToast({
				severity: 'success',
				summary: translations['app.success.title'],
				detail: translations['image.action.add.success'],
			});
		},
		[gallery.length, showToast, translations],
	);

	/**
	 * Remove image
	 *
	 * @param entry
	 */
	async function removeImage(entry: ImageEntry) {
		if (['staged'].includes(entry.situation)) {
			URL.revokeObjectURL(entry.path);

			return;
		}

		if (['existing', 'existing_dirty'].includes(entry.situation)) {
			try {
				if (!entry.storage) {
					return;
				}

				if (entry.id) {
					await requestDelete('image', {
						id: entry.id,
					});
				}

				await removeImageFile(entry.path, entry.storage, section);
			} catch {
				throw new Error('Image removal failed');
			}
		}
	}

	/**
	 * Create new image entry
	 * Note: ImageEntry.status = staged
	 *
	 * @param entry
	 */
	async function createEntry(entry: ImageEntry) {
		if (!entry.file) {
			throw new Error('ImageEntry `file` key value appears undefined');
		}

		const formData = new FormData();
		formData.append('file', entry.file);
		formData.append('section', section);
		formData.append('entity_id', String(entity_id));

		// Raw fetch rather than ApiRequest (multipart upload), so the CSRF header the
		// middleware requires on mutating /api/* requests has to be set by hand.
		const response = await fetch(Routes.get('api-image'), {
			method: 'POST',
			headers: { [CSRF_HEADER]: await getCsrfToken() },
			body: formData,
		});

		if (!response.ok) {
			const errorBody = await response.json().catch(() => null);

			throw new Error(errorBody?.error ?? 'Image upload failed');
		}

		const { path, storage } = await response.json();

		// 2. create BE record
		try {
			await createImage(
				{
					image_type: entry.image_type,
					storage,
					path,
					properties: entry.properties,
					sort_order: entry.sort_order,
					contents: buildContentsPayload(entry, attributeFields),
				},
				section,
				entity_id,
			);
		} catch {
			await removeImageFile(path, storage, section);

			throw new Error('Image creation failed');
		}
	}

	/**
	 * Update existing DB entry `contents`
	 * Note: ImageEntry.status = existing_dirty
	 *
	 * @param entry
	 */
	async function updateEntry(entry: ImageEntry) {
		if (!entry.id || entry.situation !== 'existing_dirty') {
			return;
		}

		await requestUpdate(
			'image',
			{
				contents: buildContentsPayload(entry, attributeFields),
			},
			entry.id,
		);
	}

	const hasPendingChanges =
		[logo, ...gallery].some(
			(e) => e && ['staged', 'existing_dirty'].includes(e.situation),
		) || orderChanged;

	if (errorImages) {
		return <ErrorComponent description={errorImages.message} />;
	}

	if (isLoadingImages) {
		return <LoadingComponent />;
	}

	const galleryFull = gallery.length >= GALLERY_MAX;

	return (
		<div className="flex flex-col gap-8">
			<div className="flex justify-between items-center">
				{/* Language section */}
				{Object.keys(attributeFields).length > 0 && (
					<section
						aria-labelledby="language-zone"
						className="flex gap-2"
					>
						{languages.map((lang) => (
							<Button
								key={lang}
								variant="outline"
								size="xs"
								disabled={saving}
								onClick={() => setActiveLanguage(lang)}
								className={cn(
									'relative font-semibold uppercase transition-all duration-200 rounded-md',
									activeLanguage === lang
										? 'bg-warning/80 text-warning-foreground hover:text-warning-foreground hover:bg-warning/70'
										: 'hover:text-warning-foreground hover:bg-warning/50 hover:shadow-sm',
								)}
								aria-label={lang.toUpperCase()}
							>
								{lang}
							</Button>
						))}
					</section>
				)}

				{/* Save button */}
				{mode === 'view' && permissions.edit && (
					<section aria-labelledby="update-button-zone">
						<Button
							variant="outline"
							hover="success"
							size="sm"
							onClick={() => setMode('edit')}
							title="Manage images"
						>
							<Icons.Action.Update />
							Manage images
						</Button>
					</section>
				)}
			</div>

			{/* Logo section */}
			{types.includes(ImageTypeEnum.LOGO) && (
				<section aria-labelledby="logo-zone">
					<div className="mb-3 flex items-center justify-between">
						<div>
							<h3
								id="logo-heading"
								className="text-sm font-medium text-surface-foreground"
							>
								Logo
							</h3>
							{mode === 'edit' && (
								<p className="text-xs text-muted">
									Single image · {ACCEPTED_EXTENSIONS_DESC}
								</p>
							)}
						</div>
						{logo && mode === 'edit' && (
							<span className="rounded-full bg-success-light px-2 py-0.5 text-xs font-medium text-success">
								1 / 1
							</span>
						)}
					</div>

					{!logo ? (
						mode === 'edit' ? (
							<DropZone
								label="Upload logo"
								subLabel="Drag & drop or click to browse"
								imageType={ImageTypeEnum.LOGO}
								onFiles={handleLogoFiles}
							/>
						) : (
							<span className="text-xs font-medium text-muted">
								Logo not uploaded
							</span>
						)
					) : (
						<ImageCard
							key={logo.key}
							mode={mode}
							entry={logo}
							language={activeLanguage}
							attributeFields={attributeFields}
							onRemove={() => triggerRemove(logo)}
							onContentChange={(language, field, value) =>
								handleContentChange(
									logo.key,
									language,
									field,
									value,
								)
							}
							onStatusChange={() => triggerStatusChange(logo)}
							errors={errors[logo.key]}
						/>
					)}
				</section>
			)}

			{/* Gallery section */}
			{types.includes(ImageTypeEnum.GALLERY) && (
				<section aria-labelledby="gallery-zone">
					<div className="mb-3 flex items-center justify-between">
						<div>
							<h3
								id="gallery-heading"
								className="text-sm font-medium text-surface-foreground"
							>
								Gallery
							</h3>
							{mode === 'edit' && (
								<p className="text-xs text-muted">
									Up to {GALLERY_MAX} images ·{' '}
									{ACCEPTED_EXTENSIONS_DESC}
								</p>
							)}
						</div>
						{mode === 'edit' && (
							<span
								className={[
									'rounded-full px-2 py-0.5 text-xs font-medium',
									galleryFull
										? 'bg-warning-light text-warning'
										: 'bg-surface-secondary text-muted',
								].join(' ')}
							>
								{gallery.length} / {GALLERY_MAX}
							</span>
						)}
					</div>

					{/* Existing images */}
					{mode === 'edit' ? (
						<SortableList
							items={gallery}
							onReorder={handleOrder}
							getId={(entry) => entry.key}
							className="mb-3 flex flex-col gap-2"
							renderItem={(entry) => (
								<SortableImageCard
									key={entry.key}
									mode={mode}
									entry={entry}
									language={activeLanguage}
									attributeFields={attributeFields}
									onRemove={() => triggerRemove(entry)}
									onContentChange={(language, field, value) =>
										handleContentChange(
											entry.key,
											language,
											field,
											value,
										)
									}
									onStatusChange={() =>
										triggerStatusChange(entry)
									}
									errors={errors[entry.key]}
									disabled={saving}
									isSortable={gallery.length > 1}
								/>
							)}
						/>
					) : (
						<div className="mb-3 flex flex-col gap-2">
							{gallery.map((entry) => (
								<ImageCard
									key={entry.key}
									mode={mode}
									entry={entry}
									language={activeLanguage}
									attributeFields={attributeFields}
									errors={errors[entry.key]}
								/>
							))}
						</div>
					)}

					{/* Drop zone — hide when full */}
					{!galleryFull && mode === 'edit' && (
						<DropZone
							label={
								gallery.length === 0
									? 'Upload images'
									: 'Add more images'
							}
							subLabel={
								gallery.length === 0
									? `Drag & drop or click · up to ${GALLERY_MAX} images`
									: `${GALLERY_MAX - gallery.length} slot${GALLERY_MAX - gallery.length === 1 ? '' : 's'} remaining`
							}
							imageType={ImageTypeEnum.GALLERY}
							onFiles={handleGalleryFiles}
						/>
					)}

					{gallery.length === 0 && mode === 'view' && (
						<span className="text-xs font-medium text-muted">
							No images uploaded
						</span>
					)}

					{galleryFull && mode === 'edit' && (
						<p className="mt-2 text-center text-xs text-warning">
							Gallery is full. Remove an image to add another.
						</p>
					)}
				</section>
			)}

			{/* Save button */}
			{mode === 'edit' && (
				<section aria-labelledby="save-button-zone">
					<Button
						variant="default"
						disabled={saving || !hasPendingChanges}
						onClick={handleSave}
						title="Save changes"
					>
						<Icons.Action.Save />
						{saving ? 'Saving...' : 'Save changes'}
					</Button>
				</section>
			)}

			{/* Confirmation dialog */}
			{mode === 'edit' && <ConfirmationDialog {...dialogProps} />}
		</div>
	);
}
