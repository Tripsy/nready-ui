import type { AddressModel } from '@/models/address.model';
import type { ArticleModel } from '@/models/article.model';
import type { BrandModel } from '@/models/brand.model';
import type { CarrierModel } from '@/models/carrier.model';
import type { CashFlowModel } from '@/models/cash-flow.model';
import type { CategoryModel } from '@/models/category.model';
import type { ClientModel } from '@/models/client.model';
import type { CommentModel } from '@/models/comment.model';
import type { ComplaintModel } from '@/models/complaint.model';
import type { CronHistoryModel } from '@/models/cron-history.model';
import type { DiscountModel } from '@/models/discount.model';
import type { DocumentSeriesModel } from '@/models/document-series.model';
import type { ExchangeRateModel } from '@/models/exchange-rate.model';
import type { ImageModel } from '@/models/image.model';
import type { LogDataModel } from '@/models/log-data.model';
import type { LogHistoryModel } from '@/models/log-history.model';
import type { MailQueueModel } from '@/models/mail-queue.model';
import type { PermissionModel } from '@/models/permission.model';
import type { PlaceModel } from '@/models/place.model';
import type { ProductModel } from '@/models/product.model';
import type { ProductCategoryAttributeModel } from '@/models/product-category-attribute.model';
import type { ProductVariantModel } from '@/models/product-variant.model';
import type { RatingModel } from '@/models/rating.model';
import type { TemplateModel } from '@/models/template.model';
import type { TermModel } from '@/models/term.model';
import type { UserModel } from '@/models/user.model';
import type { VendorModel } from '@/models/vendor.model';

export type DatasourceModels = {
	// `account` is a virtual data source (no list endpoint) - its entry is the
	// current authenticated user; used only for the account self-service windows.
	account: UserModel;
	address: AddressModel;
	article: ArticleModel;
	brand: BrandModel;
	carrier: CarrierModel;
	'cash-flow': CashFlowModel;
	category: CategoryModel;
	client: ClientModel;
	comment: CommentModel;
	complaint: ComplaintModel;
	'cron-history': CronHistoryModel;
	discount: DiscountModel;
	'document-series': DocumentSeriesModel;
	'exchange-rate': ExchangeRateModel;
	image: ImageModel;
	'log-data': LogDataModel;
	'log-history': LogHistoryModel;
	'mail-queue': MailQueueModel;
	permission: PermissionModel;
	place: PlaceModel;
	product: ProductModel;
	/*
	 * What a product in a category must say about itself. Gated on `product` like the backend
	 * policy, and it has no dashboard page of its own - the definitions are managed from the
	 * category they belong to, through `ManagerAttributesCategory`.
	 */
	'product-category-attribute': ProductCategoryAttributeModel;
	// The same catalog listed by the sellable unit - read-only, and gated on `product`.
	'product-variant': ProductVariantModel;
	rating: RatingModel;
	template: TemplateModel;
	term: TermModel;
	user: UserModel;
	vendor: VendorModel;
};

export type DataSourceKey = keyof DatasourceModels;
