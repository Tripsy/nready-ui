import { translate } from '@/config/translate.setup';
import { ApiError } from '@/exceptions/api.error';
import { ExecutionError } from '@/exceptions/execution.error';
import { CSRF_REJECTION_CODE } from '@/helpers/csrf.helper';
import { accumulateZodErrors } from '@/helpers/form.helper';
import type { ApiResponseFetch } from '@/types/api.type';
import type {
	FormErrorsType,
	FormSituationType,
	FormStateType,
	FormValuesType,
	GetFormValuesFnType,
	ValidateFormFnType,
} from '@/types/form.type';

/**
 * Create (`values`) and update (`values`, `entryId`) requests both reach the
 * pipeline through this shape. The entry type is deliberately not tracked —
 * `processForm` only forwards the response through as `resultData`, which is
 * `unknown` on `FormStateType` anyway; carrying an `Entry` generic here would
 * force a cast at every call site whose service returns `ApiResponseFetch<null>`.
 */
type FormOperationFnType<FormValues> =
	| ((values: FormValues) => Promise<ApiResponseFetch<unknown>>)
	| ((
			values: FormValues,
			entryId: number,
	  ) => Promise<ApiResponseFetch<unknown>>);

/**
 * Per-flow translation of a backend `ApiError` into form state. Every field is
 * optional — whatever is left out falls back to the pipeline defaults
 * (`fallbackErrorKey` for the message, `serverError` for the situation).
 */
export type MapApiErrorFnType<Situation extends string | null> = (
	error: ApiError,
) => Promise<{
	message?: string;
	situation?: Situation;
	resultData?: unknown;
}>;

type ProcessFormOptionsType<
	FormValues extends FormValuesType,
	Situation extends string | null,
> = {
	getFormValues: GetFormValuesFnType<FormValues>;
	validateForm: ValidateFormFnType<FormValues>;
	operationFunction: FormOperationFnType<FormValues>;
	/** Only set for update operations — passed as the second argument to `operationFunction`. */
	entryId?: number;
	mapApiError?: MapApiErrorFnType<Situation>;
	/** Translation key for the generic failure message. */
	fallbackErrorKey?: string;
};

/**
 * The single submit pipeline: parse → validate → request → error mapping. Used by
 * `WindowForm` for every dashboard/account entity form and by each `<flow>.action.ts` for the
 * unauthenticated auth-entry flows.
 *
 * CSRF is deliberately absent here. This function runs in the browser — the auth actions have
 * no `'use server'` directive and `WindowForm` calls it straight from a client component — so
 * a check at this point was a decision the caller could simply skip. It is enforced in
 * `src/proxy.ts` instead, in front of every mutating `/api/*` request, where a forged
 * submission actually has to pass it.
 */
export async function processForm<
	FormValues extends FormValuesType,
	State extends FormStateType<FormValues, string | null>,
>(
	formState: State,
	formData: FormData,
	// `State['situation']` rather than a separate `Situation` parameter: it has no
	// other inference site, so a standalone parameter would silently collapse to
	// its default and reject a flow's extra situations.
	options: ProcessFormOptionsType<FormValues, State['situation']>,
): Promise<State> {
	const {
		getFormValues,
		validateForm,
		operationFunction,
		entryId,
		mapApiError,
		fallbackErrorKey = 'app.error.form',
	} = options;

	// Flow-specific state fields (e.g. the recovery `token`) must survive every
	// branch, so each result spreads the incoming state. TypeScript can't narrow a
	// spread back to the generic `State`, hence the single assertion kept here.
	const buildState = (patch: {
		values?: FormValues;
		errors?: FormErrorsType<FormValues>;
		message?: string | null;
		situation?: State['situation'] | FormSituationType;
		resultData?: unknown;
	}): State => ({ ...formState, ...patch }) as State;

	// Held outside the try so a failed request echoes the user's input back
	// instead of reverting the form to the previously submitted values.
	let values: FormValues = formState.values;

	try {
		values = getFormValues(formData);

		const validated = await validateForm(values);

		if (!validated.success) {
			return buildState({
				values,
				situation: 'failedValidation',
				message: await translate('app.error.validation'),
				errors: accumulateZodErrors<FormValues>(validated.error),
			});
		}

		values = validated.data;

		// An entryId means an update — pass it as the second argument.
		const fetchResponse =
			entryId !== undefined
				? await (
						operationFunction as (
							values: FormValues,
							entryId: number,
						) => Promise<ApiResponseFetch<unknown>>
					)(values, entryId)
				: await (
						operationFunction as (
							values: FormValues,
						) => Promise<ApiResponseFetch<unknown>>
					)(values);

		return buildState({
			values,
			// Cleared because `buildState` spreads the previous state: reaching this point
			// means validation passed, so any field errors it left behind describe input the
			// user has since corrected. Without this they stay on screen next to a server
			// message that has nothing to do with them.
			errors: {},
			message: fetchResponse?.message || null,
			situation: fetchResponse?.success ? 'success' : 'serverError',
			resultData: fetchResponse?.data,
		});
	} catch (error) {
		// A CSRF rejection from the middleware outranks any per-flow mapping: it says nothing
		// about the submitted data, and `ApiRequest` has already refreshed the token and
		// retried once, so reaching here means the session genuinely cannot submit.
		if (
			error instanceof ApiError &&
			error.status === 403 &&
			(error.body as { code?: string } | undefined)?.code ===
				CSRF_REJECTION_CODE
		) {
			return buildState({
				values,
				message: await translate('app.error.csrf'),
				situation: 'csrfError',
			});
		}

		const mapped =
			mapApiError && error instanceof ApiError
				? await mapApiError(error)
				: undefined;

		let message = mapped?.message;

		// Without a per-flow mapping, only a conflict or an explicit execution
		// failure carry a message that is safe to surface verbatim.
		if (
			!message &&
			!mapApiError &&
			((error instanceof ApiError && error.status === 409) ||
				error instanceof ExecutionError)
		) {
			message = error.message;
		}

		return buildState({
			values,
			message: message || (await translate(fallbackErrorKey)),
			situation: mapped?.situation ?? 'serverError',
			errors: {},
			resultData: mapped?.resultData,
		});
	}
}
