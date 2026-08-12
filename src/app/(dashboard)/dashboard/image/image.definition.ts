import { DataTableValue } from '@/app/(dashboard)/_components/data-table-value';
import { ViewImage } from '@/app/(dashboard)/dashboard/image/view-image.component';
import { getLanguageClient, translateBatch } from '@/config/translate.setup';
import { displayImage } from '@/helpers/display.helper';
import {
	requestDelete,
	requestFind,
	requestUpdateStatus,
	requestView,
} from '@/helpers/services.helper';
import { type AuthModel, hasPermission } from '@/models/auth.model';
import {
	displayImageLabel,
	getImageContent,
	type ImageModel,
	type ImageSection,
	ImageSectionEnum,
	type ImageStatus,
	ImageStatusEnum,
	type ImageType,
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

export type ImageDataTableFiltersType = {
	global: { value: string | null; matchMode: 'contains' };
	section: { value: ImageSection | null; matchMode: 'equals' };
	entity_id: { value: string | null; matchMode: 'equals' };
	image_type: { value: ImageType | null; matchMode: 'equals' };
	status: { value: ImageStatus | null; matchMode: 'equals' };
};

export default async function dataSourceConfig(): Promise<
	DataSourceConfigType<ImageModel>
> {
	const translations = await translateBatch(
		[
			'view.title',
			'delete.title',
			'enable.title',
			'disable.title',
		] as const,
		'image.action',
	);

	function displayButtonView(
		auth: AuthModel | null,
	): DataTableValueOptionsType<ImageModel>['displayButton'] {
		return {
			action: () =>
				hasPermission(auth, 'image', 'read') ? 'view' : undefined,
			dataSource: 'image',
		};
	}

	function displayButtonStatus(
		auth: AuthModel | null,
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
		auth: AuthModel | null,
		entry: ImageModel,
	): DataTableValueOptionsType<ImageModel>['displayButton'] {
		return {
			action: () =>
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
					field: 'id',
					header: 'ID',
					defaultWidth: 88,
					sortable: true,
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							markDeleted: true,
							displayButton: displayButtonView(auth),
						}),
				},
				{
					field: 'display-image',
					header: 'Image',
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
					header: 'Type',
					body: (entry, column) =>
						DataTableValue(entry, column, {
							capitalize: true,
						}),
				},
				{
					field: 'section',
					header: 'Section',
					body: (entry, column) =>
						DataTableValue(entry, column, {
							capitalize: entry.section !== ImageSectionEnum.CMR,
							uppercase: entry.section === ImageSectionEnum.CMR,
						}),
				},
				{
					field: 'entity_id',
					header: 'Entity ID',
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							customValue: entry.entity_id.toString(),
							displayButton: displayButtonManagerImages(
								auth,
								entry,
							),
						}),
				},
				{
					field: 'status',
					header: 'Status',
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
					header: 'Created At',
					body: (entry, column) =>
						DataTableValue(entry, column, {
							displayDate: true,
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

					await removeImageFile(
						entry.path,
						entry.storage,
						entry.section,
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
				reloadEntry: (id: number) =>
					requestView<ImageModel>('image', id),
			},
		},
	};
}
