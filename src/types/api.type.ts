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
	// The array member is the `filter[key][]` list shape `buildQueryString` repeats the key
	// for - the backend's `qs` parser reads it back as an array.
	[key: string]:
		| string
		| number
		| boolean
		| null
		| undefined
		| Array<string | number>;
};

export type QueryFiltersType = Record<string, QueryValueType | NestedValueType>;
