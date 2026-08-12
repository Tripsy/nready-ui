import type { ZodSafeParseError, ZodSafeParseSuccess, z } from 'zod';
import type { ImagePropertiesType } from '@/types/image.type';
import type { PageMeta } from '@/types/page-meta.type';

// `csrfError` is emitted by `processForm` when the middleware rejects a submit for a bad or
// missing CSRF token — any form can hit it, which is why it lives here rather than in a
// per-flow union.
export type FormSituationType =
	| 'success'
	| 'failedValidation'
	| 'serverError'
	| 'csrfError'
	| null;

type FormValueType =
	| string
	| number
	| boolean
	| Date
	| PageMeta
	| ImagePropertiesType
	| null
	| undefined;

export type FormValuesType = {
	[key: string]:
		| FormValueType
		| FormValuesType
		| Record<string, FormValueType>[];
};

export type GetFormValuesFnType<FormValues> = (
	formData: FormData,
) => FormValues;

export type ValidatorOutput<V, K extends keyof V> = V[K] extends z.ZodTypeAny
	? z.output<V[K]>
	: // biome-ignore lint/suspicious/noExplicitAny: It's fine
		V[K] extends (...args: any[]) => z.ZodTypeAny
		? z.output<ReturnType<V[K]>>
		: never;

export type ValidateFormReturnType<FormValues> =
	| ZodSafeParseSuccess<FormValues>
	| ZodSafeParseError<FormValues>;

export type ValidateFormFnType<FormValues, ValidatedValues = FormValues> = (
	values: FormValues,
	isSubmit?: boolean,
) => Promise<ValidateFormReturnType<ValidatedValues>>;

export type FormErrorsType<FormValues extends FormValuesType> = {
	[K in keyof FormValues]?: FormValues[K] extends Array<infer Item>
		? Item extends FormValuesType
			? Array<FormErrorsType<Item>>
			: string[]
		: FormValues[K] extends FormValuesType
			? FormErrorsType<FormValues[K]>
			: string[];
};

export type TouchedFieldsType<T> = {
	[K in keyof T]?: T[K] extends FormValuesType
		? TouchedFieldsType<T[K]>
		: boolean;
};

// `Situation` is a parameter so a flow can widen it with its own outcomes
// (e.g. login's `maxActiveSession`) while still being driven by `processForm`.
export type FormStateType<
	FormValues extends FormValuesType,
	Situation extends string | null = FormSituationType,
> = {
	values: FormValues;
	errors: FormErrorsType<FormValues>;
	message: string | null;
	situation: Situation;
	resultData?: unknown;
};

export type GetFormStateFnType<FormValues extends FormValuesType, Data> = (
	data?: Data,
) => FormStateType<FormValues>;

export type FormComponentType<FormValues extends FormValuesType> = {
	formOperation: string;
	formValues: FormValues;
	errors: FormErrorsType<FormValues>;
	handleChange: <K extends keyof FormValues>(
		field: K,
		value: FormValues[K],
	) => void;
	pending: boolean;
};
