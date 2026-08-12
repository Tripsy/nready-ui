export type ApiRequestMode =
	| 'same-site'
	| 'use-proxy'
	| 'remote-api'
	| 'custom';

export type ApiResponseFetch<T> =
	| {
			data?: T;
			message: string;
			success: boolean;
	  }
	| undefined;

export type QueryValueType =
	| string
	| number
	| boolean
	| null
	| undefined
	| Array<string | number | boolean>;

export type NestedValueType = {
	[key: string]: string | number | boolean | null | undefined;
};

export type QueryFiltersType = Record<string, QueryValueType | NestedValueType>;
