import { arrayHasValue } from '@/helpers/objects.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import type { ClientModel } from '@/models/client.model';
import type { CmrModel } from '@/models/cmr.model';
import type { CompanyVehicleModel } from '@/models/company-vehicle.model';
import type { UserModel } from '@/models/user.model';
import type { VendorModel } from '@/models/vendor.model';
import type { Currency, StatusTransitions } from '@/types/common.type';

export const CashFlowDirectionEnum = {
	IN: 'in', // money received relative to company
	OUT: 'out', // money sent relative to company
} as const;

export type CashFlowDirection =
	(typeof CashFlowDirectionEnum)[keyof typeof CashFlowDirectionEnum];

export const CashFlowCategoryTypeEnum = {
	REVENUE: 'revenue',
	EXPENSE: 'expense',
	CORRECTION: 'correction',
} as const;

export type CashFlowCategoryType =
	(typeof CashFlowCategoryTypeEnum)[keyof typeof CashFlowCategoryTypeEnum];

export const CashFlowCategoryEnum = {
	// Revenue
	CUSTOMER: 'customer', // When company receive money from customer (invoice based)

	// Operational Expenses
	FUEL: 'fuel', // Vehicle fuel
	MAINTENANCE: 'maintenance', // Vehicle repairs
	TOLLS: 'tolls', // Road tolls

	// Employee
	EMPLOYEE_SALARY: 'employee_salary',
	EMPLOYEE_EXPENSE_ADVANCE: 'employee_advance',
	EMPLOYEE_TRAVEL_ALLOWANCE: 'employee_allowance',

	// Business Expenses
	VENDOR: 'vendor', // Third-party services
	INSURANCE: 'insurance',
	TAXES: 'taxes',

	// Correction
	REFUND: 'refund',
	EMPLOYEE_REIMBURSEMENT: 'employee_reimbursement',
} as const;

export type CashFlowCategory =
	(typeof CashFlowCategoryEnum)[keyof typeof CashFlowCategoryEnum];

export const CashFlowStatusEnum = {
	PENDING: 'pending', // Created, waiting for gateway or user redirect
	AUTHORIZED: 'authorized', // CashFlow authorized but not captured
	COMPLETED: 'completed', // Money captured
	FAILED: 'failed',
	CANCELED: 'canceled', // User canceled before completion
	EXPIRED: 'expired', // Authorization expired
	REQUIRES_ACTION: 'requires_action', // 3D Secure, etc.
} as const;

export type CashFlowStatus =
	(typeof CashFlowStatusEnum)[keyof typeof CashFlowStatusEnum];

// Only entries with specified statuses are available for update
export const MUTABLE_STATUSES = [
	CashFlowStatusEnum.PENDING,
	CashFlowStatusEnum.AUTHORIZED,
	CashFlowStatusEnum.REQUIRES_ACTION,
];

// Only entries with specified statuses are eligible for refund
export const REFUNDABLE_STATUSES = [CashFlowStatusEnum.COMPLETED];

// Allowed status transition configuration
export const STATUS_TRANSITIONS: StatusTransitions<CashFlowStatus> = {
	[CashFlowStatusEnum.PENDING]: [
		CashFlowStatusEnum.COMPLETED,
		CashFlowStatusEnum.CANCELED,
	],

	[CashFlowStatusEnum.AUTHORIZED]: [CashFlowStatusEnum.CANCELED],

	[CashFlowStatusEnum.REQUIRES_ACTION]: [CashFlowStatusEnum.CANCELED],

	[CashFlowStatusEnum.COMPLETED]: [
		// maybe allow nothing
	],

	[CashFlowStatusEnum.FAILED]: [],
	[CashFlowStatusEnum.CANCELED]: [],
	[CashFlowStatusEnum.EXPIRED]: [],
};

export const CashFlowMethodEnum = {
	CASH: 'cash',
	BANK_TRANSFER: 'bank_transfer',
	CREDIT_CARD: 'credit_card',
} as const;

export type CashFlowMethod =
	(typeof CashFlowMethodEnum)[keyof typeof CashFlowMethodEnum];

export const getExpectedCategoryType = (
	category: CashFlowCategory,
): CashFlowCategoryType => {
	const revenueCategories = [CashFlowCategoryEnum.CUSTOMER];
	const expenseCategories = [
		CashFlowCategoryEnum.FUEL,
		CashFlowCategoryEnum.MAINTENANCE,
		CashFlowCategoryEnum.TOLLS,
		CashFlowCategoryEnum.EMPLOYEE_SALARY,
		CashFlowCategoryEnum.EMPLOYEE_EXPENSE_ADVANCE,
		CashFlowCategoryEnum.EMPLOYEE_TRAVEL_ALLOWANCE,
		CashFlowCategoryEnum.VENDOR,
		CashFlowCategoryEnum.INSURANCE,
		CashFlowCategoryEnum.TAXES,
	];
	const correctionCategories = [
		CashFlowCategoryEnum.REFUND,
		CashFlowCategoryEnum.EMPLOYEE_REIMBURSEMENT,
	];

	if (arrayHasValue(category, revenueCategories)) {
		return CashFlowCategoryTypeEnum.REVENUE;
	}

	if (arrayHasValue(category, expenseCategories)) {
		return CashFlowCategoryTypeEnum.EXPENSE;
	}

	if (arrayHasValue(category, correctionCategories)) {
		return CashFlowCategoryTypeEnum.CORRECTION;
	}

	throw new Error(`Unknown category: ${category}`);
};

export const GroupedCategories = [
	{
		label: formatEnumLabel(CashFlowCategoryTypeEnum.REVENUE),
		options: [{ label: 'Customer', value: CashFlowCategoryEnum.CUSTOMER }],
	},
	{
		label: formatEnumLabel(CashFlowCategoryTypeEnum.EXPENSE),
		options: [
			{ label: 'Fuel', value: CashFlowCategoryEnum.FUEL },
			{ label: 'Maintenance', value: CashFlowCategoryEnum.MAINTENANCE },
			{ label: 'Tolls', value: CashFlowCategoryEnum.TOLLS },
			{
				label: 'Employee Salary',
				value: CashFlowCategoryEnum.EMPLOYEE_SALARY,
			},
			{
				label: 'Employee Advance',
				value: CashFlowCategoryEnum.EMPLOYEE_EXPENSE_ADVANCE,
			},
			{
				label: 'Employee Allowance',
				value: CashFlowCategoryEnum.EMPLOYEE_TRAVEL_ALLOWANCE,
			},
			{ label: 'Vendor', value: CashFlowCategoryEnum.VENDOR },
			{ label: 'Insurance', value: CashFlowCategoryEnum.INSURANCE },
			{ label: 'Taxes', value: CashFlowCategoryEnum.TAXES },
		],
	},
	{
		label: formatEnumLabel(CashFlowCategoryTypeEnum.CORRECTION),
		options: [
			{ label: 'Refund', value: CashFlowCategoryEnum.REFUND },
			{
				label: 'Employee Reimbursement',
				value: CashFlowCategoryEnum.EMPLOYEE_REIMBURSEMENT,
			},
		],
	},
];

export const filterGroupedCategories = (excludeValues: CashFlowCategory[]) => {
	return GroupedCategories.map((group) => ({
		...group,
		options: group.options.filter(
			(option) => !excludeValues.includes(option.value),
		),
	}));
};

export const getExpectedDirection = (
	categoryType: CashFlowCategoryType,
	amount: number,
): CashFlowDirection => {
	switch (categoryType) {
		case CashFlowCategoryTypeEnum.REVENUE:
			return CashFlowDirectionEnum.IN;
		case CashFlowCategoryTypeEnum.EXPENSE:
			return CashFlowDirectionEnum.OUT;
		case CashFlowCategoryTypeEnum.CORRECTION:
			if (amount > 0) {
				return CashFlowDirectionEnum.IN;
			} else {
				return CashFlowDirectionEnum.OUT;
			}
		default:
			throw new Error(`Unknown category type: ${categoryType}`);
	}
};

export const OperationalRecordTypeEnum = {
	CLIENT: 'client',
	VENDOR: 'vendor',
	EMPLOYEE: 'employee',
	COMPANY_VEHICLE: 'company_vehicle',
	CMR: 'cmr',
} as const;

export type OperationalRecordType =
	(typeof OperationalRecordTypeEnum)[keyof typeof OperationalRecordTypeEnum];

export type CashFlowCategoryOperationalRecordOptionsType = {
	required?: OperationalRecordType[];
	optional?: OperationalRecordType[];
};

type CashFlowCategoryOperationalRecordType = Partial<
	Record<CashFlowCategory, CashFlowCategoryOperationalRecordOptionsType>
>;

const CashFlowCategoryOperationalRecord: CashFlowCategoryOperationalRecordType =
	{
		[CashFlowCategoryEnum.CUSTOMER]: {
			required: [OperationalRecordTypeEnum.CLIENT],
			optional: [
				OperationalRecordTypeEnum.EMPLOYEE,
				OperationalRecordTypeEnum.CMR,
			],
		},
		[CashFlowCategoryEnum.FUEL]: {
			required: [OperationalRecordTypeEnum.COMPANY_VEHICLE],
			optional: [
				OperationalRecordTypeEnum.VENDOR,
				OperationalRecordTypeEnum.EMPLOYEE,
			],
		},
		[CashFlowCategoryEnum.MAINTENANCE]: {
			required: [OperationalRecordTypeEnum.COMPANY_VEHICLE],
			optional: [
				OperationalRecordTypeEnum.VENDOR,
				OperationalRecordTypeEnum.EMPLOYEE,
			],
		},
		[CashFlowCategoryEnum.TOLLS]: {
			required: [OperationalRecordTypeEnum.COMPANY_VEHICLE],
			optional: [
				OperationalRecordTypeEnum.VENDOR,
				OperationalRecordTypeEnum.EMPLOYEE,
				OperationalRecordTypeEnum.CMR,
			],
		},
		[CashFlowCategoryEnum.EMPLOYEE_SALARY]: {
			required: [OperationalRecordTypeEnum.EMPLOYEE],
		},
		[CashFlowCategoryEnum.EMPLOYEE_EXPENSE_ADVANCE]: {
			required: [OperationalRecordTypeEnum.EMPLOYEE],
		},
		[CashFlowCategoryEnum.EMPLOYEE_TRAVEL_ALLOWANCE]: {
			required: [OperationalRecordTypeEnum.EMPLOYEE],
		},
		[CashFlowCategoryEnum.EMPLOYEE_REIMBURSEMENT]: {
			required: [OperationalRecordTypeEnum.EMPLOYEE],
		},
		[CashFlowCategoryEnum.VENDOR]: {
			required: [OperationalRecordTypeEnum.VENDOR],
			optional: [
				OperationalRecordTypeEnum.EMPLOYEE,
				OperationalRecordTypeEnum.COMPANY_VEHICLE,
			],
		},
		[CashFlowCategoryEnum.INSURANCE]: {
			required: [OperationalRecordTypeEnum.VENDOR],
			optional: [
				OperationalRecordTypeEnum.EMPLOYEE,
				OperationalRecordTypeEnum.COMPANY_VEHICLE,
			],
		},
		[CashFlowCategoryEnum.TAXES]: {
			required: [OperationalRecordTypeEnum.VENDOR],
			optional: [
				OperationalRecordTypeEnum.EMPLOYEE,
				OperationalRecordTypeEnum.COMPANY_VEHICLE,
			],
		},
	};

export const getOperationalRecordOptions = (
	category: CashFlowCategory,
	type?: keyof CashFlowCategoryOperationalRecordOptionsType,
): Record<
	OperationalRecordType,
	keyof CashFlowCategoryOperationalRecordOptionsType
> => {
	const options = CashFlowCategoryOperationalRecord[category];

	const result = {} as Record<
		OperationalRecordType,
		keyof CashFlowCategoryOperationalRecordOptionsType
	>;

	if (!options) {
		return result;
	}

	if (!type || type === 'required') {
		for (const requiredType of options.required ?? []) {
			result[requiredType] = 'required';
		}
	}

	if (!type || type === 'optional') {
		for (const requiredType of options.optional ?? []) {
			result[requiredType] = 'optional';
		}
	}

	return result;
};

export type CashFlowOperationalRecordsType = Partial<{
	[OperationalRecordTypeEnum.CLIENT]: ClientModel | null;
	[OperationalRecordTypeEnum.EMPLOYEE]: UserModel | null;
	[OperationalRecordTypeEnum.COMPANY_VEHICLE]: CompanyVehicleModel | null;
	[OperationalRecordTypeEnum.VENDOR]: VendorModel | null;
	[OperationalRecordTypeEnum.CMR]: CmrModel | null;
}>;

export type CashFlowModel<D = Date | string> = {
	id: number;

	// Classification
	direction: CashFlowDirection;
	category_type: CashFlowCategoryType;
	category: CashFlowCategory;

	// Payment metadata
	method: CashFlowMethod;
	status: CashFlowStatus;

	// Amount data
	amount: number; // stored in cents
	netAmount: number; // decimal value (does not include VAT)
	grossAmount: number; // decimal value (includes VAT)
	vat_rate: number;
	currency: Currency;
	exchange_rate: number;

	external_reference: string | null;
	parent_id: number | null;

	// Other
	notes: string | null;

	// Timestamps
	created_at: D;
	updated_at: D;
	deleted_at: D;

	operational_records: CashFlowOperationalRecordsType;
};
