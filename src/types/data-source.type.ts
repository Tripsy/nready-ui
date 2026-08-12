import type React from 'react';
import type { JSX } from 'react';
import type { AuthModel } from '@/models/auth.model';
import type {
	PermissionEntityType,
	PermissionOperationType,
} from '@/models/permission.model';
import type {
	ActionEventType,
	ActionOperationMultipleFunctionType,
	ActionOperationSingleFunctionType,
	CreateFunctionType,
	DisplayEntryLabelFnType,
	EntriesSelectionType,
	FindFunctionType,
	PrepareEntryFnType,
	ReloadEntryFnType,
	UpdateFunctionType,
} from '@/types/action.type';
import type { QueryValueType } from '@/types/api.type';
import type { DataSourceKey } from '@/types/data-source.key';
import type {
	FormValuesType,
	GetFormStateFnType,
	GetFormValuesFnType,
	ValidateFormFnType,
} from '@/types/form.type';
import type { ButtonAppearanceType } from '@/types/html.type';
import type { WindowConfigPropsType } from '@/types/window.type';

export const DataSourceSectionEnum = {
	DASHBOARD: 'dashboard',
	PUBLIC: 'public',
} as const;

export type DataSourceSection =
	(typeof DataSourceSectionEnum)[keyof typeof DataSourceSectionEnum];

// ============================================================================
// Data Table Types
// ============================================================================

export type DataTableSelectionModeType = 'single' | 'multiple' | null;

export type DataTableFiltersType = {
	[key: string]: {
		value: QueryValueType;
		matchMode:
			| 'contains'
			| 'equals'
			| 'startsWith'
			| 'endsWith'
			| 'gt'
			| 'lt';
	};
};

export type DataTableStateType = {
	first: number;
	rows: number;
	sortField: string;
	sortOrder: 1 | 0 | -1 | null | undefined;
	filters: DataTableFiltersType;
};

export type DataTableColumnType<Entry> = {
	field: string;
	header: string;
	sortable?: boolean;
	body?: (
		entry: Entry,
		column: DataTableColumnType<Entry>,
		auth: AuthModel | null,
	) => JSX.Element | string;
	/**
	 * Width bounds in pixels. The data table is resizable, and react-aria's resize state
	 * takes plain numbers (or a `%` string) rather than CSS lengths — it has to compute
	 * with them, so a `rem` value has nothing to resolve against.
	 */
	minWidth?: number;
	maxWidth?: number;
	/**
	 * Starting width in pixels for a column whose content does not deserve an equal share
	 * of the table. Columns default to `1fr`, so a short one (an id) ends up as wide as a
	 * long one (an email). This is the initial width only — the column stays resizable,
	 * which a controlled `width` would not.
	 */
	defaultWidth?: number;
};

export type DataTableValueOptionsType<Entry> = {
	customValue?: string | JSX.Element;
	capitalize?: boolean;
	uppercase?: boolean;
	markDeleted?: boolean;
	isStatus?: boolean;
	dataSource?: DataSourceKey;
	displayDate?: boolean;
	displayButton?: {
		dataSource?: DataSourceKey; // If present will override the dataSource passed in the main options
		action: string | ((entry: Entry) => string | undefined);
		title?: string;
		alternateEntryId?: number;
	};
};

// ============================================================================
// Action Types
// ============================================================================

export type ActionConfigPermission = [
	PermissionEntityType,
	PermissionOperationType,
];

type ActionConfigBase<Entry, FormValues extends FormValuesType> = {
	windowTitle: string;
	// biome-ignore lint/suspicious/noExplicitAny: It's fine
	windowComponent?: React.ComponentType<any>; // e.g: ViewUser, FormManageUser, SetupUserPermissions, etc.
	windowTarget?: string; // Used for `link` windowType
	windowConfigProps?: WindowConfigPropsType;

	permission?: ActionConfigPermission; // Optional: dashboard data-table button gating. Omit for actions not permission-gated (e.g. account self-service, guarded by authentication only).
	customEntryCheck?: (entry: Entry) => boolean; // Additional function to check if the action is available (hint: active user cannot have `active` action)
	buttonPosition: 'left' | 'right' | 'hidden'; // Describe where the action button should be placed in data-table
	button?: ButtonAppearanceType; // Action button configuration

	reloadEntry?: ReloadEntryFnType<Entry>; // Used to reload entry data for form and view; the entry passed from the list may not have all the data
	prepareEntry?: PrepareEntryFnType<Entry>; // Prepare entry before passing to renderer; Note: this run after reloadEntry if present

	// Form-related
	validateForm?: ValidateFormFnType<FormValues>;
	getFormValues?: GetFormValuesFnType<FormValues>;
	getFormState?: GetFormStateFnType<FormValues, Entry>;

	events?: Partial<Record<'success' | 'error', ActionEventType<Entry>>>;
};

// Each variant enforces the valid windowType <-> entriesSelection correlation
type FormCreateActionConfig<
	Entry,
	FormValues extends FormValuesType,
	ValidatedValues = FormValues,
> = ActionConfigBase<Entry, FormValues> & {
	windowType: 'form';
	entriesSelection: 'free';
	operationFunction: CreateFunctionType<Entry, ValidatedValues>;
	validateForm: ValidateFormFnType<FormValues>;
	getFormValues: GetFormValuesFnType<FormValues>;
	getFormState: GetFormStateFnType<FormValues, Entry>;
};

type FormUpdateActionConfig<
	Entry,
	FormValues extends FormValuesType,
	ValidatedValues = FormValues,
> = ActionConfigBase<Entry, FormValues> & {
	windowType: 'form';
	entriesSelection: 'single';
	operationFunction: UpdateFunctionType<Entry, ValidatedValues>;
	validateForm: ValidateFormFnType<FormValues>;
	getFormValues: GetFormValuesFnType<FormValues>;
	getFormState: GetFormStateFnType<FormValues, Entry>;
	reloadEntry?: ReloadEntryFnType<Entry>;
};

type SingleActionConfig<
	Entry,
	FormValues extends FormValuesType,
> = ActionConfigBase<Entry, FormValues> & {
	windowType: 'action';
	entriesSelection: 'single';
	operationFunction: ActionOperationSingleFunctionType<Entry>;
};

type MultipleActionConfig<
	Entry,
	FormValues extends FormValuesType,
> = ActionConfigBase<Entry, FormValues> & {
	windowType: 'action';
	entriesSelection: 'multiple';
	operationFunction: ActionOperationMultipleFunctionType;
};

type ViewActionConfig<
	Entry,
	FormValues extends FormValuesType,
> = ActionConfigBase<Entry, FormValues> & {
	windowType: 'view';
	entriesSelection: 'single';
	operationFunction?: never;
	reloadEntry?: ReloadEntryFnType<Entry>;
};

type OtherActionConfig<
	Entry,
	FormValues extends FormValuesType,
> = ActionConfigBase<Entry, FormValues> & {
	windowType: 'other';
	entriesSelection: EntriesSelectionType;
	operationFunction?: never;
};

type LinkActionConfig<
	Entry,
	FormValues extends FormValuesType,
> = ActionConfigBase<Entry, FormValues> & {
	windowType: 'link';
	entriesSelection: EntriesSelectionType;
	operationFunction?: never;
};

export type ActionConfigType<
	Entry,
	FormValues extends FormValuesType = FormValuesType,
	ValidatedValues = FormValues,
> =
	| FormCreateActionConfig<Entry, FormValues, ValidatedValues>
	| FormUpdateActionConfig<Entry, FormValues, ValidatedValues>
	| SingleActionConfig<Entry, FormValues>
	| MultipleActionConfig<Entry, FormValues>
	| ViewActionConfig<Entry, FormValues>
	| OtherActionConfig<Entry, FormValues>
	| LinkActionConfig<Entry, FormValues>;

export type ActionsType<Entry> = {
	// biome-ignore lint/suspicious/noExplicitAny: It's fine
	[key: string]: ActionConfigType<Entry, any, any>;
} & {
	// biome-ignore lint/suspicious/noExplicitAny: It's fine
	create?: FormCreateActionConfig<Entry, any, any>;
	// biome-ignore lint/suspicious/noExplicitAny: It's fine
	update?: FormUpdateActionConfig<Entry, any, any>;
	// biome-ignore lint/suspicious/noExplicitAny: It's fine
	delete?: SingleActionConfig<Entry, any> | MultipleActionConfig<Entry, any>;
	// biome-ignore lint/suspicious/noExplicitAny: It's fine
	restore?: SingleActionConfig<Entry, any> | MultipleActionConfig<Entry, any>;
};

export type DataSourceConfigType<Entry> = {
	dataTable?: {
		state: DataTableStateType;
		columns: DataTableColumnType<Entry>[];
		find: FindFunctionType<Entry>;
		onRowSelect?: (entry: Entry) => void;
		onRowUnselect?: (entry: Entry) => void;
	};
	displayEntryLabel?: DisplayEntryLabelFnType<Entry>;
	actions?: ActionsType<Entry>;
};
