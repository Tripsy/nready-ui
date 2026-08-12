import dayjs from '@/config/dayjs.config';
import { Configuration } from '@/config/settings.config';

const DEFAULT_DATE_FORMAT = 'YYYY-MM-DD';

/**
 * Create a current date
 *
 * @param startOfDay - If true, returns the current date at 00:00:00.000
 * @returns {Date} - The current date
 */
export function createCurrentDate(startOfDay: boolean = false): Date {
	const now = new Date();

	if (startOfDay) {
		now.setHours(0, 0, 0, 0);
	}

	return now;
}

/**
 * Create a future date by adding seconds to the current date
 *
 * @param {number} seconds - The number of seconds to add
 * @throws {Error} - If seconds is zero or negative
 * @returns {Date} - The future date
 */
export function createFutureDate(seconds: number): Date {
	if (seconds <= 0) {
		throw new Error('Seconds should a positive number greater than 0');
	}

	const currentDate = new Date();

	return new Date(currentDate.getTime() + seconds * 1000);
}

/**
 * Create a past date by subtracting seconds from the current date
 *
 * @param {number} seconds - The number of seconds to subtract
 * @throws {Error} - If seconds is zero or negative
 * @returns {Date} - The past date
 */
export function createPastDate(seconds: number): Date {
	if (seconds <= 0) {
		throw new Error('Seconds should a positive number greater than 0');
	}

	const currentDate = new Date();

	return new Date(currentDate.getTime() - seconds * 1000);
}

/**
 * Check if a string is a valid date.
 *
 * Expects the calendar part to lead in `YYYY-MM-DD` form; anything after it (a time, an
 * offset) is parsed leniently.
 *
 * @param {string} date - The date string to check
 * @returns {boolean} - True if the date is valid, false otherwise
 */
export function isValidDate(date: string): boolean {
	if (!dayjs(date.trim().slice(0, 10), DEFAULT_DATE_FORMAT, true).isValid()) {
		return false;
	}

	return dayjs(date).isValid();
}

/**
 * Convert string to Date object using dayjs
 *
 * @param date
 * @param startOfDay
 */
export function stringToDate(date: string, startOfDay: boolean = false): Date {
	const parsed = dayjs(date);

	if (!parsed.isValid()) {
		throw new Error(`Invalid date value: "${date}"`);
	}

	if (startOfDay) {
		return parsed.startOf('day').toDate();
	}

	return parsed.toDate();
}

/**
 * Date formatter with dayjs
 *
 * @param value - Date input (string, Date, null, undefined)
 * @param format - Output format (or preset)
 * @param options - { strict: boolean }
 * @returns Formatted string or null
 */
export function formatDate(
	value: string | number | Date | null | undefined,
	format?: 'default' | 'date-time' | 'time',
	options?: {
		customFormat?: string;
		strict?: boolean;
	},
): string | null {
	// Handle empty values
	if (
		value === null ||
		value === undefined ||
		(typeof value === 'string' && value.trim() === '')
	) {
		if (options?.strict) {
			throw new Error('Invalid date: null/undefined');
		}

		return null;
	}

	const date = dayjs(value);

	// Validate date
	if (!date.isValid()) {
		if (options?.strict) {
			throw new Error(`Invalid date: ${value}`);
		}

		return null;
	}

	switch (format) {
		case 'default':
			return date.format(DEFAULT_DATE_FORMAT);
		case 'date-time':
			return date.format('DD-MM-YYYY, HH:mm');
		case 'time':
			return date.format('HH:mm');
		default:
			// No `if (format)` fallback here: the cases above cover every member of the
			// union, so this branch is only reached when `format` is undefined.
			if (options?.customFormat) {
				return date.format(options.customFormat);
			}

			return date.toISOString();
	}
}

/**
 * Combine a date with a specified wall-clock time.
 *
 * `setHours` resolves against the runtime's zone, which is the driver's own device zone —
 * these run client-side. That is the intended reading: "20:00" means 20:00 where the driver
 * is, and serializing the resulting Date yields the correct UTC instant for the backend. Do
 * not reach for `app.timezone` here; company time applies to filter day-boundaries only
 * (see `toUTCISOString`).
 *
 * @param date
 * @param time
 */
export function combineDateAndTime(date: Date, time: string): Date {
	const parts = time.split(':').map(Number);
	const hours = parts[0];
	const minutes = parts[1];

	if (Number.isNaN(hours) || Number.isNaN(minutes)) {
		throw new Error(`Invalid time format: "${time}". Expected "HH:MM".`);
	}

	const result = new Date(date);
	result.setHours(hours, minutes, 0, 0);

	return result;
}

/**
 * Calculate the difference between two dates
 *
 * @example
 * dateDiff(start, end, 'minutes') → 90
 * dateDiff(start, end, 'display') → "1h 30'"
 * dateDiff(start, end, 'seconds') → 5400
 */
// Overload signatures
export function dateDiff(
	start: string | Date,
	end: string | Date,
	unit: 'display',
): string;
export function dateDiff(
	start: string | Date,
	end: string | Date,
	unit: 'seconds' | 'minutes' | 'hours',
): number;
// Implementation signature
export function dateDiff(
	startDate: string | Date,
	endDate: string | Date,
	unit: 'seconds' | 'minutes' | 'hours' | 'display',
): number | string {
	const start = dayjs(startDate);
	const end = dayjs(endDate);

	if (!start.isValid() || !end.isValid()) {
		throw new Error('Invalid date arguments provided for dateDiff');
	}

	/*
	 * Rounds the magnitude up and restores the sign. A bare `Math.ceil` on a signed value
	 * rounds positives away from zero (90.2 -> 91) but negatives toward it (-90.2 -> -90),
	 * so the same interval measured backwards came back a unit short of the one measured
	 * forwards.
	 */
	const roundAwayFromZero = (value: number) =>
		Math.sign(value) * Math.ceil(Math.abs(value));

	switch (unit) {
		case 'seconds':
			return roundAwayFromZero(end.diff(start, 'second', true));
		case 'minutes':
			return roundAwayFromZero(end.diff(start, 'minute', true));
		case 'hours':
			return roundAwayFromZero(end.diff(start, 'hour', true));
		case 'display': {
			const diffInMinutes = end.diff(start, 'minute');

			const magnitude = Math.abs(diffInMinutes);
			const sign = diffInMinutes < 0 ? '-' : '';

			return `${sign}${Math.floor(magnitude / 60)}h ${magnitude % 60}'`;
		}
	}
}

/**
 * Relative description of a past date, e.g. "2 hours ago".
 */
export function timeAgo(date: string | Date): string {
	const target = dayjs(date);

	if (!target.isValid()) {
		throw new Error('Invalid date argument provided for timeAgo');
	}

	return target.fromNow();
}

/**
 * Convert a datetime string to a UTC ISO string for sending to the backend, reading it as
 * **company time** (`app.timezone`) rather than the viewer's.
 *
 * That is deliberate, and the one place the app departs from device-local input: this backs
 * the dashboard's date-range filters, where a picked day has to mean the company's day so
 * two managers in different countries filtering "27-07" get the same rows. Instants typed
 * into forms take the opposite convention — see `combineDateAndTime`.
 *
 * @param value - Date string in company time (e.g. "2024-01-15" or "2024-01-15T20:00")
 * @param endOfDay
 * @param timezone - IANA timezone (e.g. "Europe/Bucharest"), falls back to app config
 * @returns UTC ISO string (e.g. "2024-01-15T18:00:00.000Z")
 */
export function toUTCISOString(
	value: string,
	endOfDay: boolean = false,
	timezone?: string,
): string {
	const tz = timezone ?? Configuration.get('app.timezone');
	let parsed = dayjs.tz(value, tz);

	if (!parsed.isValid()) {
		throw new Error(`Invalid date value: "${value}"`);
	}

	if (endOfDay) {
		parsed = parsed.endOf('day');
	}

	return parsed.utc().toISOString();
}
