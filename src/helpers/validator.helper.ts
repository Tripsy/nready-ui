import { z } from 'zod';
import { translateBatch } from '@/config/translate.setup';
import {
	createCurrentDate,
	dateDiff,
	isValidDate,
	stringToDate,
} from '@/helpers/date.helper';
import { replaceVars } from '@/helpers/string.helper';
import { type Language, LanguageEnum } from '@/types/common.type';

/**
 * Validation messages that are generic enough to be written once rather than copied into
 * every entity's locale file — constraint messages the helpers below produce themselves,
 * as opposed to the per-field `invalid_<field>` messages an entity owns.
 *
 *   const validatorMessages = [...sharedValidatorMessages, 'invalid_amount'] as const;
 */
export const sharedValidatorMessages = [
	'only_positive',
	'name_min',
	'password_min',
	'password_condition_capital_letter',
	'password_condition_number',
	'password_condition_special_character',
	'password_confirm_mismatch',
	'invalid_contents',
	'duplicate_contents',
] as const;

/**
 * Resolves a validator's message record, taking shared keys from the `shared.validation`
 * namespace and everything else from the entity's own.
 *
 * Use this in an entity's `validateForm` in place of a bare
 * `translateBatch(validatorMessages, '<entity>.validation')` whenever the tuple spreads
 * `sharedValidatorMessages`.
 */
export async function resolveValidatorMessages<
	const T extends readonly string[],
>(validatorMessages: T, entity: string): Promise<Record<T[number], string>> {
	/*
	 * Shared keys are kept out of the entity batch deliberately: asking for
	 * `<entity>.validation.only_positive` resolves to the raw key — and, with app.debug on,
	 * logs a missing-translation warning for a key that was never meant to live there.
	 */
	const entityMessages = validatorMessages.filter(
		(key) => !(sharedValidatorMessages as readonly string[]).includes(key),
	);

	const [shared, entitySpecific] = await Promise.all([
		translateBatch(sharedValidatorMessages, 'shared.validation'),
		translateBatch(entityMessages, `${entity}.validation`),
	]);

	// Shared spread last so a shared key always resolves from the shared namespace, matching
	// the backend, where membership of the shared list decides the namespace outright.
	return { ...entitySpecific, ...shared } as Record<T[number], string>;
}

export abstract class IsValidator {
	/**
	 * Checks if the provided IBAN (RO version) is valid.
	 *
	 * @param {string} iban
	 * @returns {boolean}
	 */
	protected isValidIBAN(iban: string): boolean {
		const clean = iban.replace(/\s+/g, '').toUpperCase();

		// ISO 13616 registers Romania as RO2!n4!a16!c — two check digits, a four-letter bank
		// code, then sixteen *alphanumeric* characters. This demanded `\d{16}`, so every IBAN
		// whose account part contains a letter was rejected outright, including the ECBS
		// reference value RO49AAAA1B31007593840000.
		if (!/^RO\d{2}[A-Z]{4}[A-Z0-9]{16}$/.test(clean)) {
			return false;
		}

		const rearranged = clean.slice(4) + clean.slice(0, 4);

		let remainder = rearranged.replace(/[A-Z]/g, (char) =>
			(char.charCodeAt(0) - 55).toString(),
		);

		while (remainder.length > 2) {
			remainder =
				(parseInt(remainder.slice(0, 9), 10) % 97).toString() +
				remainder.slice(9);
		}

		return parseInt(remainder, 10) % 97 === 1;
	}

	/**
	 * Checks if the provided postal code is valid.
	 *
	 * @param {string} postalCode
	 * @returns {boolean}
	 */
	protected isValidPostalCode(postalCode: string): boolean {
		return /^[0-9]{6}$/.test(postalCode);
	}

	/**
	 * Checks if the provided phone number is valid.
	 *
	 * Deliberately an E.164 *shape* check rather than a per-country rule: these numbers
	 * belong to clients, carriers and CMR contacts who are routinely outside Romania, so
	 * anything narrower would reject legitimate counterparties. Optional leading `+` then
	 * 7 to 15 digits — E.164 caps a number at 15, and 7 is the shortest plausible national
	 * one. A leading trunk zero (0722…) is accepted because that is how numbers are written
	 * locally.
	 *
	 * @param {string} phoneNumber
	 * @returns {boolean}
	 */
	protected isValidPhoneNumber(phoneNumber: string): boolean {
		// Separators are a presentation choice — numbers get pasted with spaces, dots,
		// dashes or parentheses — so strip them before looking at the digits.
		const clean = phoneNumber.replace(/[\s.\-()]/g, '');

		return /^\+?\d{7,15}$/.test(clean);
	}

	/**
	 * Checks if the provided CNP is valid.
	 *
	 * Verifies the structure that is safe to assume for every CNP — 13 digits, a sex/century
	 * digit of 1-9, and a real month — plus the control digit, which is what actually catches
	 * a mistyped number.
	 *
	 * @param {string} cnp
	 * @returns {boolean}
	 */
	protected isValidCNP(cnp: string): boolean {
		if (!/^[0-9]{13}$/.test(cnp)) {
			return false;
		}

		// First digit encodes sex and century; 0 is never issued.
		if (cnp[0] === '0') {
			return false;
		}

		const month = Number(cnp.slice(3, 5));

		if (month < 1 || month > 12) {
			return false;
		}

		// Control digit: weight the first twelve digits by the national constant, sum, then
		// take mod 11 — a remainder of 10 stands for a control digit of 1.
		const controlKey = '279146358279';

		let sum = 0;

		for (let i = 0; i < 12; i++) {
			sum += Number(cnp[i]) * Number(controlKey[i]);
		}

		const remainder = sum % 11;

		return (remainder === 10 ? 1 : remainder) === Number(cnp[12]);
	}
}

type EmptyValue = null | undefined;

export abstract class BaseValidator<
	TMessage extends ReadonlyArray<string>,
	TEmpty extends EmptyValue = null,
> extends IsValidator {
	private readonly emptyValue: TEmpty;
	private readonly message: Record<TMessage[number], string>;

	constructor(
		message: Record<TMessage[number], string>,
		options?: { emptyValue?: TEmpty },
	) {
		super();

		this.message = message;
		this.emptyValue = options?.emptyValue ?? (undefined as TEmpty);
	}

	protected getMessage<K extends TMessage[number]>(
		key: K,
		vars?: Record<string, string | number>,
	): string {
		const message = this.message[key];
		return vars ? replaceVars(message, vars) : message;
	}

	/**
	 * Coerces null input values to the configured empty value (null or undefined)
	 * before passing to the schema.
	 *
	 * @param {z.ZodTypeAny} schema - The Zod schema to apply the transformation to
	 * @returns A preprocessed schema that converts null to the configured empty value
	 */
	private coerceEmpty(schema: z.ZodTypeAny) {
		const empty = this.emptyValue;

		return z.preprocess((val) => {
			return val === null ? empty : val;
		}, schema);
	}

	/**
	 * Preprocesses a schema to handle optional fields
	 */
	private preprocessOptional<T extends z.ZodTypeAny>(schema: T) {
		const empty = this.emptyValue;

		return z.preprocess(
			(val) => {
				if (val === null || val === undefined || val === '') {
					return empty;
				}
				return val;
			},
			empty === null ? schema.nullable() : schema.optional(),
		);
	}

	/**
	 * Builds a message object by merging default messages with custom messages
	 */
	private buildMessage(
		messageDefault: Record<string, string>,
		messageData?: string | Record<string, string>,
	) {
		if (!messageData) {
			return messageDefault;
		}

		if (typeof messageData === 'string') {
			return {
				...messageDefault,
				invalid: messageData,
			};
		}

		return {
			...messageDefault,
			...messageData,
		};
	}

	/**
	 * Creates a required string validator with optional length constraints
	 *
	 * @example
	 * // Required string
	 * validateString('Name is required')
	 *
	 * // With custom messages & options
	 * validateString({
	 *   invalid: 'Invalid name',
	 *   min_chars: 'Name too short',
	 *   max_chars: 'Name too long'
	 * }, {
	 *   minChars: 2,
	 *   maxChars: 50
	 * })
	 *
	 * // With min length only
	 * validateString('Password is required', { minChars: 8 })
	 */
	// Overload signatures
	protected validateString(
		messageData?:
			| string
			| { invalid?: string; min_chars?: string; max_chars?: string },
		optionsData?: { required?: true; minChars?: number; maxChars?: number },
	): z.ZodType<string>;

	protected validateString(
		messageData?:
			| string
			| { invalid?: string; min_chars?: string; max_chars?: string },
		optionsData?: { required: false; minChars?: number; maxChars?: number },
	): z.ZodType<string | TEmpty>;

	// Implementation signature
	protected validateString(
		messageData?:
			| string
			| { invalid?: string; min_chars?: string; max_chars?: string },
		optionsData?: {
			required?: boolean;
			minChars?: number;
			maxChars?: number;
		},
	): z.ZodType<string | TEmpty> {
		const defaultMessages: Record<string, string> = {
			invalid: 'Invalid value (e.g.: string required)',
		};

		const options = {
			required: true,
			...optionsData,
		};

		if (options?.minChars) {
			defaultMessages.min_chars = `Value must be at least ${options.minChars} characters long`;
		}

		if (options?.maxChars) {
			defaultMessages.max_chars = `Value must be at most ${options.maxChars} characters long`;
		}

		const message = this.buildMessage(defaultMessages, messageData);

		let baseSchema = z.string({ message: message.invalid }).trim();

		// Apply length constraints
		if (options?.minChars) {
			baseSchema = baseSchema.min(options.minChars, {
				message:
					message.min_chars ??
					`Minimum ${options.minChars} characters required`,
			});
		}

		if (options?.maxChars) {
			baseSchema = baseSchema.max(options.maxChars, {
				message:
					message.max_chars ??
					`Maximum ${options.maxChars} characters allowed`,
			});
		}

		if (options.required) {
			const requiredSchema = options.minChars
				? baseSchema
				: baseSchema.min(1, { message: message.invalid });

			return this.coerceEmpty(requiredSchema) as z.ZodType<string>;
		}

		return this.preprocessOptional(baseSchema) as z.ZodType<
			string | TEmpty
		>;
	}

	/**
	 * @description Validate number
	 *
	 * @example
	 * // Required number
	 * validateNumber('Name is required')
	 *
	 * // With custom messages & options
	 * validateNumber({
	 *   invalid: 'Invalid name',
	 *   only_positive: 'Only positive number',
	 *   no_decimals: 'Decimals not allowed',
	 *   max_decimals: 'Too many decimals',
	 * }, {
	 *   required: true,
	 *   onlyPositive: true,
	 *   allowDecimals: number
	 * })
	 */
	// Overload signatures
	protected validateNumber(
		messageData?:
			| string
			| {
					invalid?: string;
					only_positive?: string;
					no_decimals?: string;
					max_decimals?: string;
			  },
		optionsData?: {
			required?: true;
			onlyPositive?: boolean;
			allowDecimals?: number;
		},
	): z.ZodType<number>;

	protected validateNumber(
		messageData?:
			| string
			| {
					invalid?: string;
					only_positive?: string;
					no_decimals?: string;
					max_decimals?: string;
			  },
		optionsData?: {
			required: false;
			onlyPositive?: boolean;
			allowDecimals?: number;
		},
	): z.ZodType<number | TEmpty>;

	// Implementation signature
	protected validateNumber(
		messageData?:
			| string
			| {
					invalid?: string;
					only_positive?: string;
					no_decimals?: string;
					max_decimals?: string;
			  },
		optionsData?: {
			required?: boolean;
			onlyPositive?: boolean;
			allowDecimals?: number;
		},
	): z.ZodType<number | TEmpty> {
		const options = {
			required: true,
			onlyPositive: true,
			allowDecimals: 0,
			...optionsData,
		};

		const defaultMessages: Record<string, string> = {
			invalid: 'Invalid value (e.g.: number required)',
		};

		if (options.onlyPositive) {
			defaultMessages.only_positive = 'Must be a positive number';
		}

		if (options.allowDecimals < 1) {
			defaultMessages.no_decimals = 'Must not contain decimals';
		} else {
			defaultMessages.max_decimals = `Must have at most ${options.allowDecimals} decimal place${options.allowDecimals !== 1 ? 's' : ''}`;
		}

		const message = this.buildMessage(defaultMessages, messageData);

		let baseSchema = z.coerce.number({ message: message.invalid });

		if (options.onlyPositive) {
			baseSchema = baseSchema.positive({
				message: message.only_positive,
			});
		}

		if (options.allowDecimals < 1) {
			baseSchema = baseSchema.int({ message: message.no_decimals });
		} else {
			baseSchema = baseSchema.refine(
				(value) => {
					// Check if the number has more than the allowed decimal places
					const decimalPart = value.toString().split('.')[1];

					return (
						!decimalPart ||
						decimalPart.length <= options.allowDecimals
					);
				},
				{
					message: message.max_decimals,
				},
			);
		}

		if (options.required) {
			return this.coerceEmpty(baseSchema) as z.ZodType<number>;
		}

		return this.preprocessOptional(baseSchema) as z.ZodType<
			number | TEmpty
		>;
	}

	/**
	 * Validate enum value
	 */
	// Overload signatures
	protected validateEnum<T extends Record<string, string>>(
		enumObj: T,
		message: string,
		optionsData?: { required?: true },
	): z.ZodType<T[keyof T]>;

	protected validateEnum<T extends Record<string, string>>(
		enumObj: T,
		message: string,
		optionsData: { required: false },
	): z.ZodType<T[keyof T] | TEmpty>;

	// Implementation signature
	protected validateEnum<T extends Record<string, string>>(
		enumObj: T,
		message: string,
		optionsData?: { required?: boolean },
	): z.ZodType<T[keyof T] | TEmpty> {
		const options = {
			required: true,
			...optionsData,
		};

		const values = Object.values(enumObj);
		const baseSchema = z.enum(values, { message });

		if (options.required) {
			return baseSchema as unknown as z.ZodType<T[keyof T]>;
		}

		return this.preprocessOptional(baseSchema) as unknown as z.ZodType<
			T[keyof T] | TEmpty
		>;
	}

	/**
	 * Convert string to boolean and validate - rejects false values if options.required = true
	 */
	// Overload signatures
	protected validateBoolean(
		message?: string,
		optionsData?: { required?: true },
	): z.ZodType<boolean>;

	protected validateBoolean(
		message: string,
		optionsData: { required: false },
	): z.ZodType<boolean | TEmpty>;

	// Implementation signature
	protected validateBoolean(
		message: string = 'This field must be true',
		optionsData?: {
			required?: boolean;
		},
	): z.ZodType<boolean | TEmpty> {
		const options = {
			required: true,
			...optionsData,
		};

		const baseSchema = z.preprocess((val) => {
			if (val === 'true' || val === true) {
				return true;
			}

			if (val === 'false' || val === false) {
				return false;
			}

			return val;
		}, z.boolean({ message }));

		if (options.required) {
			return baseSchema.refine((val) => val, { message });
		}

		return baseSchema;
	}

	/**
	 * Validate ID
	 */
	protected validateId(
		message: string = 'Invalid ID',
		optionsData?: { required?: boolean },
	): z.ZodType<number | TEmpty> {
		const options = {
			required: true,
			...optionsData,
		};

		if (options.required) {
			return this.validateNumber(message, {
				required: true,
				onlyPositive: true,
			});
		}

		return this.validateNumber(message, {
			required: false,
			onlyPositive: true,
		});
	}

	/**
	 * Validate date string and convert to `Date` object with time validation
	 *
	 * @param messageData - Optional string or object with custom error messages
	 * @param optionsData - Configuration options for date validation
	 *
	 * @example
	 * // Basic usage
	 * const basicSchema = validateDate({
	 *   invalid: 'Please enter a valid date'
	 * });
	 *
	 * @example
	 * // Client-side with time requirement and 1-hour future limit
	 * const appointmentSchema = validateDate({
	 *   invalid_date: 'Invalid appointment date',
	 *   invalid_date_format: 'Please use format: YYYY-MM-DD HH:MM',
	 *   invalid_future_date: 'Appointments cannot be more than 1 hour in the future'
	 * }, {
	 *   requireTime: true,
	 *   maxFutureSeconds: 3600 // 1 hour
	 * });
	 *
	 *
	 * @example
	 * // Custom date format (European format)
	 * const europeanSchema = validateDate({
	 *   invalid_date: 'Invalid date',
	 *   invalid_date_format: 'Use format: DD.MM.YYYY'
	 * }, {
	 *   dateFormat: /^\d{2}\.\d{2}\.\d{4}$/,
	 *   requireTime: false
	 * });
	 *
	 * @example
	 * // Complete example with all options
	 * const fullSchema = validateDate({
	 *   invalid_date: 'Invalid date',
	 *   invalid_date_format: 'Format must be YYYY-MM-DD HH:MM',
	 *   invalid_past_date: 'Cannot be more than 1 hour in the past',
	 *   invalid_future_date: 'Cannot be more than 2 hours in the future'
	 * }, {
	 *   runtime: 'server',
	 *   dateFormat: /^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}$/,
	 *   requireTime: true,
	 *   maxPastSeconds: 3600, // 1 hour
	 *   maxFutureSeconds: 7200 // 2 hours
	 * });
	 */
	// Overload signatures
	protected validateDate(
		messageData?:
			| string
			| {
					invalid_date: string;
					invalid_date_format: string;
					invalid_past_date: string;
					invalid_future_date: string;
			  },
		optionsData?: {
			required?: true;
			dateFormat?: RegExp;
			requireTime?: boolean;
			maxPastSeconds?: number;
			maxFutureSeconds?: number;
		},
	): z.ZodType<string>;

	protected validateDate(
		messageData:
			| string
			| {
					invalid_date: string;
					invalid_date_format: string;
					invalid_past_date: string;
					invalid_future_date: string;
			  },
		optionsData: {
			required: false;
			dateFormat?: RegExp;
			requireTime?: boolean;
			maxPastSeconds?: number;
			maxFutureSeconds?: number;
		},
	): z.ZodType<string | TEmpty>;

	// Implementation signature
	protected validateDate(
		messageData?:
			| string
			| {
					invalid_date: string;
					invalid_date_format: string;
					invalid_past_date: string;
					invalid_future_date: string;
			  },
		optionsData?: {
			required?: boolean;
			dateFormat?: RegExp;
			requireTime?: boolean;
			maxPastSeconds?: number;
			maxFutureSeconds?: number;
		},
	): z.ZodType<string | TEmpty> {
		const options = {
			required: true,
			dateFormat: /^\d{4}-\d{2}-\d{2}/,
			requireTime: false,
			...optionsData,
		};

		const defaultMessages: Record<string, string> = {
			invalid_date: 'Invalid date',
		};

		if (options.requireTime) {
			options.dateFormat =
				optionsData?.dateFormat ??
				/^\d{4}-\d{2}-\d{2}[T\s](?:[01]\d|2[0-3]):[0-5]\d/;
			defaultMessages.invalid_date_format =
				'Date must include time (e.g., 2024-01-15 14:30 or 2024-01-15T14:30:00)';
		}

		if (options.maxPastSeconds) {
			defaultMessages.invalid_past_date = `Date cannot be more than ${options.maxPastSeconds} seconds in the past`;
		}

		if (options.maxFutureSeconds) {
			defaultMessages.invalid_future_date = `Date cannot be more than ${options.maxFutureSeconds} seconds in the future`;
		}

		const message = this.buildMessage(defaultMessages, messageData);

		let baseSchema = z.string({ message: message.invalid }).trim();

		baseSchema = baseSchema.refine((val) => options.dateFormat.test(val), {
			message: message.invalid_date_format,
		});

		baseSchema = baseSchema.refine((val) => isValidDate(val), {
			message: message.invalid_date,
		});

		baseSchema = baseSchema.refine(
			(val) => {
				if (options.maxPastSeconds === undefined) {
					return true;
				}

				const secondsDiff = dateDiff(
					stringToDate(val, !options.requireTime),
					createCurrentDate(!options.requireTime),
					'seconds',
				);

				if (secondsDiff > 0) {
					return secondsDiff <= options.maxPastSeconds;
				}

				return true;
			},
			{
				message: message.invalid_past_date,
			},
		);

		baseSchema = baseSchema.refine(
			(val) => {
				if (options.maxFutureSeconds === undefined) {
					return true;
				}

				const secondsDiff = dateDiff(
					stringToDate(val, !options.requireTime),
					createCurrentDate(!options.requireTime),
					'seconds',
				);

				if (secondsDiff < 0) {
					return Math.abs(secondsDiff) <= options.maxFutureSeconds;
				}

				return true;
			},
			{
				message: message.invalid_future_date,
			},
		);

		if (options.required) {
			return this.coerceEmpty(baseSchema) as z.ZodType<string>;
		}

		return this.preprocessOptional(baseSchema) as z.ZodType<
			string | TEmpty
		>;
	}

	/**
	 * Validate time string in HH:MM format with optional interval constraints
	 *
	 * @param messageData - Optional string or object with custom error messages
	 * @param optionsData - Configuration options for time validation
	 *
	 * @example
	 * // Basic usage
	 * const basicSchema = validateTime('Invalid time');
	 *
	 * @example
	 * // Required with 5-minute intervals
	 * const timeSchema = validateTime({
	 *   invalid: 'Please enter a valid time',
	 *   invalid_format: 'Use format: HH:MM',
	 *   invalid_interval: 'Time must be in 5-minute intervals'
	 * });
	 *
	 * @example
	 * // Optional with custom interval (15 minutes)
	 * const optionalSchema = validateTime({
	 *   invalid: 'Invalid time'
	 * }, {
	 *   required: false,
	 *   minuteInterval: 15
	 * });
	 *
	 * @example
	 * // With time range restrictions
	 * const workingHoursSchema = validateTime({
	 *   invalid: 'Invalid time',
	 *   invalid_range: 'Time must be between 09:00 and 17:00'
	 * }, {
	 *   minTime: '09:00',
	 *   maxTime: '17:00',
	 *   minuteInterval: 5
	 * });
	 */
	// Overload signatures
	protected validateTime(
		messageData?:
			| string
			| {
					invalid?: string;
					invalid_format?: string;
					invalid_interval?: string;
					invalid_range?: string;
			  },
		optionsData?: {
			required?: true;
			minuteInterval?: number;
			minTime?: string;
			maxTime?: string;
		},
	): z.ZodType<string>;

	protected validateTime(
		messageData?:
			| string
			| {
					invalid?: string;
					invalid_format?: string;
					invalid_interval?: string;
					invalid_range?: string;
			  },
		optionsData?: {
			required: false;
			minuteInterval?: number;
			minTime?: string;
			maxTime?: string;
		},
	): z.ZodType<string | TEmpty>;

	// Implementation signature
	protected validateTime(
		messageData?:
			| string
			| {
					invalid?: string;
					invalid_format?: string;
					invalid_interval?: string;
					invalid_range?: string;
			  },
		optionsData?: {
			required?: boolean;
			minuteInterval?: number;
			minTime?: string;
			maxTime?: string;
		},
	): z.ZodType<string | TEmpty> {
		const options = {
			required: true,
			minuteInterval: 1,
			...optionsData,
		};

		const defaultMessages: Record<string, string> = {
			invalid: 'Invalid time',
			invalid_format: 'Time must be in HH:MM format (e.g., 09:00, 14:30)',
		};

		if (options.minuteInterval && options.minuteInterval > 1) {
			defaultMessages.invalid_interval = `Time must be in ${options.minuteInterval}-minute intervals`;
		}

		if (options.minTime || options.maxTime) {
			defaultMessages.invalid_range = `Time must be between ${options.minTime ?? '00:00'} and ${options.maxTime ?? '23:59'}`;
		}

		const message = this.buildMessage(defaultMessages, messageData);

		const parseTimeToMinutes = (time: string): number | null => {
			const match = time.match(/^([0-1][0-9]|2[0-3]):([0-5][0-9])$/);

			if (!match) {
				return null;
			}

			const hours = parseInt(match[1], 10);
			const minutes = parseInt(match[2], 10);

			return hours * 60 + minutes;
		};

		let baseSchema = z.string({ message: message.invalid });

		// Validate format (HH:MM)
		baseSchema = baseSchema.refine(
			(val) => /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/.test(val),
			{ message: message.invalid_format },
		);

		// Validate minute interval (e.g., 00, 05, 10, 15, etc.)
		if (options.minuteInterval && options.minuteInterval > 1) {
			baseSchema = baseSchema.refine(
				(val) => {
					const minutes = parseTimeToMinutes(val);
					if (minutes === null) return false;
					return minutes % options.minuteInterval === 0;
				},
				{ message: message.invalid_interval },
			);
		}

		// Validate min time
		if (options.minTime) {
			baseSchema = baseSchema.refine(
				(val) => {
					const timeMinutes = parseTimeToMinutes(val);
					const minMinutes = options.minTime
						? parseTimeToMinutes(options.minTime)
						: null;

					if (timeMinutes === null || minMinutes === null) {
						return false;
					}

					return timeMinutes >= minMinutes;
				},
				{ message: message.invalid_range },
			);
		}

		// Validate max time
		if (options.maxTime) {
			baseSchema = baseSchema.refine(
				(val) => {
					const timeMinutes = parseTimeToMinutes(val);
					const maxMinutes = options.maxTime
						? parseTimeToMinutes(options.maxTime)
						: null;

					if (timeMinutes === null || maxMinutes === null) {
						return false;
					}

					return timeMinutes <= maxMinutes;
				},
				{ message: message.invalid_range },
			);
		}

		const timeSchema = baseSchema;

		if (options.required) {
			return this.coerceEmpty(timeSchema) as z.ZodType<string>;
		}

		// No '' -> undefined transform: the refinements above reject the empty string
		// before it could reach one, and form values arrive as null (getFormDataAsString),
		// which coerceEmpty already maps to the empty value.
		const optionalSchema = timeSchema.optional();

		return this.coerceEmpty(optionalSchema) as z.ZodType<string | TEmpty>;
	}

	protected validateMeta(
		message = {
			invalid_meta_title: 'Invalid title',
			invalid_meta_description: 'Invalid description',
			invalid_meta_keywords: 'Invalid keywords',
		},
	) {
		return z.preprocess(
			(val) => val ?? {},
			z.object({
				title: this.validateString(message.invalid_meta_title, {
					required: false,
				}),
				description: this.validateString(
					message.invalid_meta_description,
					{ required: false },
				),
				keywords: this.validateString(message.invalid_meta_keywords, {
					required: false,
				}),
			}),
		);
	}

	// Overload signatures
	protected validateLanguage(
		message?: string,
		optionsData?: {
			required?: true;
		},
	): z.ZodType<Language>;

	protected validateLanguage(
		message: string,
		optionsData: {
			required: false;
		},
	): z.ZodType<Language | TEmpty>;

	// Implementation signature
	protected validateLanguage(
		message = 'Invalid language',
		optionsData?: { required?: boolean },
	): z.ZodType<Language | TEmpty> {
		const options = {
			required: true,
			...optionsData,
		};

		if (options.required) {
			return this.validateEnum(LanguageEnum, message, { required: true });
		}

		return this.validateEnum(LanguageEnum, message, { required: false });
	}

	// Overload signatures
	protected validatePassword(
		message: {
			invalid_password: string;
			password_min: string;
			password_condition_capital_letter: string;
			password_condition_number: string;
			password_condition_special_character: string;
		},
		optionsData: {
			required?: true;
			minLength: number;
			requireUppercase?: boolean;
			requireNumber?: boolean;
			requireSpecial?: boolean;
		},
	): z.ZodType<string>;

	protected validatePassword(
		message: {
			invalid_password: string;
			password_min: string;
			password_condition_capital_letter: string;
			password_condition_number: string;
			password_condition_special_character: string;
		},
		optionsData: {
			required: false;
			minLength: number;
			requireUppercase?: boolean;
			requireNumber?: boolean;
			requireSpecial?: boolean;
		},
	): z.ZodType<string | TEmpty>;

	// Implementation signature
	protected validatePassword(
		message: {
			invalid_password: string;
			password_min: string;
			password_condition_capital_letter: string;
			password_condition_number: string;
			password_condition_special_character: string;
		},
		optionsData?: {
			required?: boolean;
			minLength: number;
			requireUppercase?: boolean;
			requireNumber?: boolean;
			requireSpecial?: boolean;
		},
	): z.ZodType<string | TEmpty> {
		const options = {
			required: true,
			minLength: 8,
			requireUppercase: true,
			requireNumber: true,
			requireSpecial: true,
			...optionsData,
		};

		let baseSchema = z
			.string(message.invalid_password)
			.min(options.minLength, {
				message: message.password_min,
			});

		// Add refinements based on requirements
		if (options.requireUppercase) {
			baseSchema = baseSchema.refine((value) => /[A-Z]/.test(value), {
				message: message.password_condition_capital_letter,
			});
		}

		if (options.requireNumber) {
			baseSchema = baseSchema.refine((value) => /[0-9]/.test(value), {
				message: message.password_condition_number,
			});
		}

		if (options.requireSpecial) {
			baseSchema = baseSchema.refine(
				(value) => /[!@#$%^&*()_+{}[\]:;<>,.?~\\/-]/.test(value),
				{
					message: message.password_condition_special_character,
				},
			);
		}

		if (options.required) {
			return baseSchema;
		}

		return this.preprocessOptional(baseSchema) as z.ZodType<
			string | TEmpty
		>;
	}

	// Overload signatures
	protected validateEmail(
		message: string,
		optionsData?: { required?: true },
	): z.ZodType<string>;

	protected validateEmail(
		message: string,
		optionsData?: { required: false },
	): z.ZodType<string | TEmpty>;

	// Implementation signature
	protected validateEmail(
		message: string = 'Invalid email address',
		optionsData?: { required?: boolean },
	): z.ZodType<string | TEmpty> {
		const options = {
			required: true,
			...optionsData,
		};

		const baseSchema = z.email({ message });

		if (options.required) {
			return this.coerceEmpty(baseSchema) as z.ZodType<string>;
		}

		// No '' -> undefined transform: the refinements above reject the empty string
		// before it could reach one, and form values arrive as null (getFormDataAsString),
		// which coerceEmpty already maps to the empty value.
		const optionalSchema = baseSchema.optional();

		return this.coerceEmpty(optionalSchema) as z.ZodType<string | TEmpty>;
	}

	// Overload signatures
	protected validateIBAN(
		message: string,
		optionsData?: { required?: true },
	): z.ZodType<string>;

	protected validateIBAN(
		message: string,
		optionsData?: { required: false },
	): z.ZodType<string | TEmpty>;

	// Implementation signature
	protected validateIBAN(
		message: string = 'Invalid IBAN',
		optionsData?: {
			required?: boolean;
		},
	): z.ZodType<string | TEmpty> {
		const options = {
			required: true,
			...optionsData,
		};

		const baseSchema = z
			.string({ message })
			.trim()
			.refine((val) => this.isValidIBAN(val), { message });

		if (options.required) {
			return this.coerceEmpty(baseSchema) as z.ZodType<string>;
		}

		// No '' -> undefined transform: the refinements above reject the empty string
		// before it could reach one, and form values arrive as null (getFormDataAsString),
		// which coerceEmpty already maps to the empty value.
		const optionalSchema = baseSchema.optional();

		return this.coerceEmpty(optionalSchema) as z.ZodType<string | TEmpty>;
	}

	// Overload signatures
	protected validatePersonalIdentificationNumber(
		message: string,
		optionsData?: { required?: true },
	): z.ZodType<string>;

	protected validatePersonalIdentificationNumber(
		message: string,
		optionsData?: { required: false },
	): z.ZodType<string | TEmpty>;

	// Implementation signature
	protected validatePersonalIdentificationNumber(
		message: string = 'Invalid CNP',
		optionsData?: {
			required?: boolean;
		},
	): z.ZodType<string | TEmpty> {
		const options = {
			required: true,
			...optionsData,
		};

		const baseSchema = z
			.string({ message })
			.trim()
			.refine((val) => this.isValidCNP(val), { message });

		if (options.required) {
			return this.coerceEmpty(baseSchema) as z.ZodType<string>;
		}

		// No '' -> undefined transform: the refinements above reject the empty string
		// before it could reach one, and form values arrive as null (getFormDataAsString),
		// which coerceEmpty already maps to the empty value.
		const optionalSchema = baseSchema.optional();

		return this.coerceEmpty(optionalSchema) as z.ZodType<string | TEmpty>;
	}

	// Overload signatures
	protected validatePostalCode(
		message: string,
		optionsData?: { required?: true },
	): z.ZodType<string>;

	protected validatePostalCode(
		message: string,
		optionsData?: { required: false },
	): z.ZodType<string | TEmpty>;

	// Implementation signature
	protected validatePostalCode(
		message: string = 'Invalid postal code',
		optionsData?: {
			required?: boolean;
		},
	): z.ZodType<string | TEmpty> {
		const options = {
			required: true,
			...optionsData,
		};

		const baseSchema = z
			.string({ message })
			.trim()
			.refine((val) => this.isValidPostalCode(val), { message });

		if (options.required) {
			return this.coerceEmpty(baseSchema) as z.ZodType<string>;
		}

		// No '' -> undefined transform: the refinements above reject the empty string
		// before it could reach one, and form values arrive as null (getFormDataAsString),
		// which coerceEmpty already maps to the empty value.
		const optionalSchema = baseSchema.optional();

		return this.coerceEmpty(optionalSchema) as z.ZodType<string | TEmpty>;
	}

	// Overload signatures
	protected validatePhone(
		message: string,
		optionsData?: { required?: true },
	): z.ZodType<string>;

	protected validatePhone(
		message: string,
		optionsData?: { required: false },
	): z.ZodType<string | TEmpty>;

	// Implementation signature
	protected validatePhone(
		message: string = 'Invalid phone number',
		optionsData?: {
			required?: boolean;
		},
	): z.ZodType<string | TEmpty> {
		const options = {
			required: true,
			...optionsData,
		};

		const baseSchema = z
			.string({ message })
			.trim()
			.refine((val) => this.isValidPhoneNumber(val), { message });

		if (options.required) {
			return this.coerceEmpty(baseSchema) as z.ZodType<string>;
		}

		// No '' -> undefined transform: the refinements above reject the empty string
		// before it could reach one, and form values arrive as null (getFormDataAsString),
		// which coerceEmpty already maps to the empty value.
		const optionalSchema = baseSchema.optional();

		return this.coerceEmpty(optionalSchema) as z.ZodType<string | TEmpty>;
	}
}
