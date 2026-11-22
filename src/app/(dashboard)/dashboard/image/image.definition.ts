import { DataTableValue } from '@/app/(dashboard)/_components/data-table-value';
import { UsageGuideImage } from '@/app/(dashboard)/dashboard/image/usage-guide-image.component';
import { ViewImage } from '@/app/(dashboard)/dashboard/image/view-image.component';
import { Icons } from '@/components/icon.component';
import { getLanguageClient, translateBatch } from '@/config/translate.setup';
import { displayImage } from '@/helpers/display.helper';
import { logRejection } from '@/helpers/logger.helper';
import {
	requestDelete,
	requestFind,
	requestUpdateStatus,
	requestView,
} from '@/helpers/services.helper';
import {
	enumTranslationKeys,
	translateEnumLabel,
} from '@/helpers/string.helper';
import { type AccountModel, hasPermission } from '@/models/account.model';
import {
	displayImageLabel,
	getImageContent,
	type ImageModel,
	type ImageSection,
	ImageSectionEnum,
	type ImageStatus,
	ImageStatusEnum,
	type ImageType,
	ImageTypeEnum,
	showImage,
} from '@/models/image.model';
import type { PermissionEntityType } from '@/models/permission.model';
import { removeImageFile } from '@/services/image.service';
import type { FindFunctionParamsType } from '@/types/action.type';
import type { DatasourceModels } from '@/types/data-source.key';
import type {
	DataSourceConfigType,
	DataTableValueOptionsType,
} from '@/types/data-source.type';
import type { EntityId } from '@/types/entity-id.type';

export type ImageDataTableFiltersType = {
	global: { value: string | null; matchMode: 'contains' };
	section: { value: ImageSection | null; matchMode: 'equals' };
	entity_id: { value: string | null; matchMode: 'equals' };
	image_type: { value: ImageType | null; matchMode: 'equals' };
	status: { value: ImageStatus | null; matchMode: 'equals' };
};

/**
 * Sections whose owner is a data source with a `managerImages` window. A variant's images are
 * managed from its product's window, and `product_variant` is no data source at all - opening
 * one by section would ask the API for a `product_variant` view that does not exist.
 */
const MANAGER_IMAGES_SECTIONS: ReadonlySet<ImageSection> = new Set([
	ImageSectionEnum.ARTICLE,
	ImageSectionEnum.BRAND,
	ImageSectionEnum.PRODUCT,
]);

export default async function dataSourceConfig(): Promise<
	DataSourceConfigType<ImageModel>
> {
	const [translations, labels] = await Promise.all([
		translateBatch(
			[
				'view.title',
				'delete.title',
				'enable.title',
				'disable.title',
				'guide.title',
			] as const,
			'image.action',
		),
		translateBatch(
			[
				'field.created_at',
				'field.image',
				'field.entity',
				'field.id',
				'field.image_type',
				'field.section',
				'field.status',
				...enumTranslationKeys('enum.type', ImageTypeEnum),
				...enumTranslationKeys('enum.section', ImageSectionEnum),
			] as const,
			'image',
		),
	]);

	function displayButtonView(
		auth: AccountModel | null,
	): DataTableValueOptionsType<ImageModel>['displayButton'] {
		return {
			action: () =>
				hasPermission(auth, 'image', 'read') ? 'view' : undefined,
			dataSource: 'image',
		};
	}

	function displayButtonStatus(
		auth: AccountModel | null,
	): DataTableValueOptionsType<ImageModel>['displayButton'] {
		return {
			action: (entry: ImageModel) => {
				if (!hasPermission(auth, 'image', 'update')) {
					return undefined;
				}

				return entry.status === ImageStatusEnum.ACTIVE
					? 'disable'
					: 'enable';
			},
			dataSource: 'image',
		};
	}

	function displayButtonManagerImages(
		auth: AccountModel | null,
		entry: ImageModel,
	): DataTableValueOptionsType<ImageModel>['displayButton'] {
		return {
			action: () =>
				MANAGER_IMAGES_SECTIONS.has(entry.section) &&
				hasPermission(
					auth,
					entry.section as PermissionEntityType,
					'read',
				)
					? 'managerImages'
					: undefined,
			dataSource: entry.section as keyof DatasourceModels,
			alternateEntryId: entry.entity_id, // It will force the target mode load the entry otherwise it will be just {id: entity_id}
		};
	}

	return {
		dataTable: {
			state: {
				first: 0,
				rows: 10,
				sortField: 'id',
				sortOrder: -1 as const,
				filters: {
					global: { value: null, matchMode: 'contains' },
					section: { value: null, matchMode: 'equals' },
					entity_id: { value: null, matchMode: 'equals' },
					image_type: { value: null, matchMode: 'equals' },
					status: { value: null, matchMode: 'equals' },
				} satisfies ImageDataTableFiltersType,
			},
			columns: [
				{
					field: 'display-image',
					header: labels['field.image'],
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: displayImage({
								src: showImage(entry.path, entry.storage),
								alt:
									getImageContent(entry, getLanguageClient())
										?.title || '',
								width: 48,
								height: 48,
							}),
						}),
				},
				{
					field: 'image_type',
					header: labels['field.image_type'],
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: translateEnumLabel(
								labels,
								'enum.type',
								entry.image_type,
							),
						}),
				},
				{
					field: 'section',
					header: labels['field.section'],
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: translateEnumLabel(
								labels,
								'enum.section',
								entry.section,
							),
						}),
				},
				{
					field: 'entity_id',
					header: labels['field.entity'],
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							// The listing carries no name for the owner - `image` is polymorphic
							// and joins none of its targets - so the cell names its section
							customValue: translateEnumLabel(
								labels,
								'enum.section',
								entry.section,
							),
							displayButton: displayButtonManagerImages(
								auth,
								entry,
							),
						}),
				},
				{
					field: 'status',
					header: labels['field.status'],
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							dataSource: 'image',
							isStatus: true,
							markDeleted: true,
							displayButton: displayButtonStatus(auth),
						}),
					minWidth: 128,
					maxWidth: 128,
				},
				{
					field: 'created_at',
					header: labels['field.created_at'],
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							displayDate: true,
							markDeleted: true,
							displayButton: displayButtonView(auth),
						}),
				},
			],
			find: (params: FindFunctionParamsType) =>
				requestFind<ImageModel>('image', params),
		},
		displayEntryLabel: (entry: ImageModel) => {
			return displayImageLabel(entry);
		},
		actions: {
			delete: {
				windowType: 'action',
				windowTitle: translations['delete.title'],
				permission: ['image', 'delete'],
				entriesSelection: 'single',
				operationFunction: async (entry: ImageModel) => {
					const result = await requestDelete('image', entry);

					// The row is gone; a file left behind is an orphan, not a failed delete.
					await removeImageFile(entry.path, entry.storage).catch(
						logRejection('Image file removal failed', {
							id: entry.id,
							storage: entry.storage,
						}),
					);

					return result;
				},
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
			enable: {
				windowType: 'action',
				windowTitle: translations['enable.title'],
				permission: ['image', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: ImageModel) =>
					entry.status === ImageStatusEnum.INACTIVE,
				operationFunction: (entry: ImageModel) =>
					requestUpdateStatus('image', entry, 'active'),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'default',
				},
			},
			disable: {
				windowType: 'action',
				windowTitle: translations['disable.title'],
				permission: ['image', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: ImageModel) =>
					entry.status === ImageStatusEnum.ACTIVE,
				operationFunction: (entry: ImageModel) =>
					requestUpdateStatus('image', entry, 'inactive'),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
			view: {
				windowType: 'view',
				windowTitle: translations['view.title'],
				windowComponent: ViewImage,
				windowConfigProps: {
					size: 'xl',
					closeOnBackdrop: true,
					closeOnEscape: true,
				},
				permission: ['image', 'read'],
				entriesSelection: 'single',
				buttonPosition: 'hidden',
				reloadEntry: (id: EntityId) =>
					requestView<ImageModel>('image', id),
			},
			guide: {
				windowType: 'other',
				windowTitle: translations['guide.title'],
				windowComponent: UsageGuideImage,
				windowConfigProps: {
					size: 'xl2',
					closeOnBackdrop: true,
					closeOnEscape: true,
				},
				permission: ['image', 'read'],
				entriesSelection: 'free',
				buttonPosition: 'right',
				button: {
					variant: 'outline',
					hover: 'info',
					icon: Icons.Info,
				},
			},
		},
	};
}
