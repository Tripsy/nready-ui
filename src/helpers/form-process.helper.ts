import { translate } from '@/config/translate.setup';
import { ApiError } from '@/exceptions/api.error';
import { ExecutionError } from '@/exceptions/execution.error';
import { CSRF_REJECTION_CODE } from '@/helpers/csrf.helper';
import {
	accumulateIssueErrors,
	accumulateZodErrors,
	mergeNormalizedValues,
	type ValidationIssueType,
} from '@/helpers/form.helper';
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
 * pipeline through this shape. The entry type is deliberately not tracked -
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
 * optional - whatever is left out falls back to the pipeline defaults
 * (`fallbackErrorKey` for the message, `serverError` for the situation).
 */
export type MapApiErrorFnType<Situation extends string | null> = (
	error: ApiError,
) => Promise<{
	message?: string;
	situation?: Situation;
	resultData?: unknown;
}>;

/**
 * `ValidatedValues` is what the validator *produces*, which is not always what the form holds:
 * a schema that trims a slug, upper-cases a currency or coerces a typed figure to a number
 * changes the shape on the way through. It defaults to `FormValues`, so a form whose schema only
 * checks is unaffected - and the values echoed back into the state are the validated ones, which
 * is why a lower-cased slug appears in the field after a submit.
 */
type ProcessFormOptionsType<
	FormValues extends FormValuesType,
	Situation extends string | null,
	ValidatedValues = FormValues,
> = {
	getFormValues: GetFormValuesFnType<FormValues>;
	validateForm: ValidateFormFnType<FormValues, ValidatedValues>;
	operationFunction: FormOperationFnType<ValidatedValues>;
	/** Only set for update operations - passed as the second argument to `operationFunction`. */
	entryId?: number;
	mapApiError?: MapApiErrorFnType<Situation>;
	/** Translation key for the generic failure message. */
	fallbackErrorKey?: string;
};

/**
 * The validation issues a backend rejection carries, if it carries any.
 *
 * `ApiResponseFetch` does not declare `errors` because most responses have none - the envelope
 * (`output-handler.middleware.ts` on the API side) fills it only where a controller ran a schema
 * and the parse failed. A service-layer 422 leaves it empty, which is what keeps this apart from
 * the messages `mapApiError` handles.
 */
function readApiIssues(error: ApiError): ValidationIssueType[] {
	const raw = (error.body as { errors?: unknown } | undefined)?.errors;

	if (!Array.isArray(raw)) {
		return [];
	}

	return raw.filter(
		(issue): issue is ValidationIssueType =>
			!!issue &&
			typeof issue === 'object' &&
			Array.isArray((issue as ValidationIssueType).path) &&
			typeof (issue as ValidationIssueType).message === 'string',
	);
}

/**
 * The issues as one line for the form's message.
 *
 * Deduplicated, because one rule breaking across several entries of a list repeats its wording
 * per index and a user reads that as the same complaint three times. The path is left out: these
 * messages come from the same catalog the client validator uses and are written to name their own
 * subject, so prefixing `contents.0.meta.title` adds nothing a reader can act on.
 */
function joinIssueMessages(issues: ValidationIssueType[]): string {
	return [...new Set(issues.map((issue) => issue.message))].join(' · ');
}

/**
 * The single submit pipeline: parse → validate → request → error mapping. Used by
 * `WindowForm` for every dashboard/account entity form and by each `<flow>.action.ts` for the
 * unauthenticated auth-entry flows.
 *
 * CSRF is deliberately absent here. This function runs in the browser - the auth actions have
 * no `'use server'` directive and `WindowForm` calls it straight from a client component - so
 * a check at this point was a decision the caller could simply skip. It is enforced in
 * `src/proxy.ts` instead, in front of every mutating `/api/*` request, where a forged
 * submission actually has to pass it.
 */
export async function processForm<
	FormValues extends FormValuesType,
	State extends FormStateType<FormValues, string | null>,
	ValidatedValues = FormValues,
>(
	formState: State,
	formData: FormData,
	// `State['situation']` rather than a separate `Situation` parameter: it has no
	// other inference site, so a standalone parameter would silently collapse to
	// its default and reject a flow's extra situations.
	options: ProcessFormOptionsType<
		FormValues,
		State['situation'],
		ValidatedValues
	>,
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

		/*
		 * The validated shape, echoed back as the form's values, so a slug the schema
		 * lower-cased appears lower-cased. Merged rather than assigned: `mergeNormalizedValues`
		 * keeps the parse result only where it did not change a field's type - see there for
		 * why a form holding a schema's converted output cannot validate again.
		 */
		values = mergeNormalizedValues(values, validated.data);

		// An entryId means an update - pass it as the second argument.
		const operationValues = validated.data;

		const fetchResponse =
			entryId !== undefined
				? await (
						operationFunction as (
							values: ValidatedValues,
							entryId: number,
						) => Promise<ApiResponseFetch<unknown>>
					)(operationValues, entryId)
				: await (
						operationFunction as (
							values: ValidatedValues,
						) => Promise<ApiResponseFetch<unknown>>
					)(operationValues);

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
		/*
		 * A rejection by the backend's own validator, reported field by field. It outranks a
		 * per-flow `mapApiError`, which describes the service-layer failures - those carry a
		 * written message and no issue list, so the two never compete for the same response.
		 *
		 * The messages go into the form's message line rather than onto the fields: nothing
		 * renders `state.errors` (both hosts show what their own validation pass produced), and
		 * the next debounced run would clear a field error the client itself does not raise.
		 * They are carried in `errors` all the same, so the state stays a faithful record of
		 * what came back.
		 *
		 * `serverError`, not `failedValidation`: the latter is the client's own verdict, and
		 * `FormComponentSubmit` disables the button while it stands - which the client clears
		 * only by finding errors of its own. Here it has none (that is why the request went out
		 * at all), so the form would be left with no way to submit again.
		 */
		const issues = error instanceof ApiError ? readApiIssues(error) : [];

		if (issues.length > 0) {
			return buildState({
				values,
				errors: accumulateIssueErrors<FormValues>(issues),
				message: joinIssueMessages(issues),
				situation: 'serverError',
			});
		}

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

		/*
		 * Without a per-flow mapping, only a conflict, an unprocessable entity or an explicit
		 * execution failure carry a message that is safe to surface verbatim.
		 *
		 * A 422 reaching here has already been sorted from the validator's field-by-field
		 * rejections above, so what is left is a rule the service states in prose and writes
		 * for an editor to read - which category a label is declared by, why a bundle is too
		 * small. The fallback message says none of that, and a form that only says something
		 * went wrong leaves the editor with nothing to change.
		 */
		if (
			!message &&
			!mapApiError &&
			((error instanceof ApiError &&
				(error.status === 409 || error.status === 422)) ||
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
