import type { AddressModel } from '@/models/address.model';
import type { BrandModel } from '@/models/brand.model';
import type { CashFlowModel } from '@/models/cash-flow.model';
import type { ClientModel } from '@/models/client.model';
import type { CmrModel } from '@/models/cmr.model';
import type { CmrSessionModel } from '@/models/cmr-session.model';
import type { CmrVehicleModel } from '@/models/cmr-vehicle.model';
import type { CompanyVehicleModel } from '@/models/company-vehicle.model';
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
import type { VehicleModel } from '@/models/vehicle.model';
import type { VendorModel } from '@/models/vendor.model';
import type { WorkSessionModel } from '@/models/work-session.model';
import type { WorkSessionVehicleModel } from '@/models/work-session-vehicle.model';

export type DatasourceModels = {
	// `account` is a virtual data source (no list endpoint) — its entry is the
	// current authenticated user; used only for the account self-service windows.
	account: UserModel;
	address: AddressModel;
	brand: BrandModel;
	'cash-flow': CashFlowModel;
	client: ClientModel;
	cmr: CmrModel;
	'cmr-session': CmrSessionModel;
	'cmr-vehicle': CmrVehicleModel;
	'company-vehicle': CompanyVehicleModel;
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
	vehicle: VehicleModel;
	vendor: VendorModel;
	'work-session': WorkSessionModel;
	'work-session-vehicle': WorkSessionVehicleModel;
};

export type DataSourceKey = keyof DatasourceModels;
