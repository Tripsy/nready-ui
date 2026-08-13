import type { AddressModel } from '@/models/address.model';
import type { BrandModel } from '@/models/brand.model';
import type { CarrierModel } from '@/models/carrier.model';
import type { CashFlowModel } from '@/models/cash-flow.model';
import type { CategoryModel } from '@/models/category.model';
import type { ClientModel } from '@/models/client.model';
import type { CronHistoryModel } from '@/models/cron-history.model';
import type { DocumentSeriesModel } from '@/models/document-series.model';
import type { ImageModel } from '@/models/image.model';
import type { LogDataModel } from '@/models/log-data.model';
import type { LogHistoryModel } from '@/models/log-history.model';
import type { MailQueueModel } from '@/models/mail-queue.model';
import type { PermissionModel } from '@/models/permission.model';
import type { PlaceModel } from '@/models/place.model';
import type { TemplateModel } from '@/models/template.model';
import type { UserModel } from '@/models/user.model';
import type { VendorModel } from '@/models/vendor.model';

export type DatasourceModels = {
	// `account` is a virtual data source (no list endpoint) — its entry is the
	// current authenticated user; used only for the account self-service windows.
	account: UserModel;
	address: AddressModel;
	brand: BrandModel;
	carrier: CarrierModel;
	'cash-flow': CashFlowModel;
	category: CategoryModel;
	client: ClientModel;
	'cron-history': CronHistoryModel;
	'document-series': DocumentSeriesModel;
	image: ImageModel;
	'log-data': LogDataModel;
	'log-history': LogHistoryModel;
	'mail-queue': MailQueueModel;
	permission: PermissionModel;
	place: PlaceModel;
	template: TemplateModel;
	user: UserModel;
	vendor: VendorModel;
};

export type DataSourceKey = keyof DatasourceModels;
