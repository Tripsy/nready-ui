import type { ApiResponseFetch, QueryFiltersType } from '@/types/api.type';

export type FindFunctionParamsType = {
	order_by?: string;
	direction?: 'ASC' | 'DESC';
	limit?: number;
	page?: number;
	filter?: QueryFiltersType;
};

export type FindFunctionResponseType<Model> = {
	entries: Model[];
	pagination?: {
		page: number;
		limit: number;
		total: number;
	};
};

export type FindFunctionType<Model> = (
	params: FindFunctionParamsType,
) => Promise<FindFunctionResponseType<Model> | undefined>;

export type CreateFunctionType<Model, Params> = (
	params: Params,
) => Promise<ApiResponseFetch<Partial<Model>>>;

export type UpdateFunctionType<Model, Params> = (
	params: Params,
	id: number,
) => Promise<ApiResponseFetch<Partial<Model>>>;

export type FormOperationFunctionType<Entry, Params> =
	| CreateFunctionType<Entry, Params>
	| UpdateFunctionType<Entry, Params>;

export type DeleteMultipleFunctionType = (
	ids: number[],
) => Promise<ApiResponseFetch<null>>;

export type RestoreMultipleFunctionType = (
	ids: number[],
) => Promise<ApiResponseFetch<null>>;

export type ActionOperationMultipleFunctionType =
	| DeleteMultipleFunctionType
	| RestoreMultipleFunctionType;

export type DeleteSingleFunctionType<Entry> = (
	entry: Entry,
) => Promise<ApiResponseFetch<null>>;

export type RestoreSingleFunctionType<Entry> = (
	entry: Entry,
) => Promise<ApiResponseFetch<null>>;

export type ActionOperationSingleFunctionType<Entry> =
	| DeleteSingleFunctionType<Entry>
	| RestoreSingleFunctionType<Entry>;

export type OperationFunctionType<Entry, Params> =
	| FormOperationFunctionType<Entry, Params>
	| ActionOperationMultipleFunctionType
	| ActionOperationSingleFunctionType<Entry>;

export type ActionEventType<Data> = (data?: Data) => void;

export type DisplayEntryLabelFnType<Entry> = (entry: Entry) => string;

export type EntriesSelectionType = 'free' | 'single' | 'multiple'; // Allowed entries selection for an action (eg: `free` means no selection)

export type ReloadEntryFnType<Entry> = (
	id: number,
) => Promise<Entry | undefined>;

export type PrepareEntryFnType<Entry> = (entry: Entry) => Partial<Entry>;
