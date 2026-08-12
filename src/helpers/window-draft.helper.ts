import { logger } from '@/helpers/logger.helper';
import type { FormValuesType } from '@/types/form.type';

const DRAFT_KEY_PREFIX = 'window-draft:';

/**
 * Credential-like fields never reach storage. The test is on the field name, so a
 * newly added password/token field is excluded by default instead of relying on
 * someone remembering to extend a list.
 */
const SENSITIVE_FIELD_PATTERN = /password|token|secret/i;

const draftKey = (uid: string): string => `${DRAFT_KEY_PREFIX}${uid}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

/** Drops credential-like fields at every level — nested groups and row arrays included. */
const stripSensitiveFields = (
	values: Record<string, unknown>,
): Record<string, unknown> => {
	const safeValues: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(values)) {
		if (SENSITIVE_FIELD_PATTERN.test(key)) {
			continue;
		}

		if (isRecord(value)) {
			safeValues[key] = stripSensitiveFields(value);
		} else if (Array.isArray(value)) {
			safeValues[key] = value.map((item) =>
				isRecord(item) ? stripSensitiveFields(item) : item,
			);
		} else {
			safeValues[key] = value;
		}
	}

	return safeValues;
};

/**
 * Drafts live in `sessionStorage`, not in the `localStorage` that holds the window
 * stack: half-typed input is tab-scoped and dies with the tab, so a shared browser
 * never surfaces one person's unfinished form to the next.
 */
const getStorage = (): Storage | null => {
	if (typeof window === 'undefined') {
		return null;
	}

	try {
		return window.sessionStorage;
	} catch (error: unknown) {
		// Disabled storage (private mode, blocked cookies) — drafts are optional
		logger.warn('Session storage unavailable, drafts disabled', error);

		return null;
	}
};

export function readWindowDraft(uid: string): FormValuesType | null {
	const storage = getStorage();
	const storedDraft = storage?.getItem(draftKey(uid));

	if (!storedDraft) {
		return null;
	}

	try {
		/*
		 * Stripped on the way out as well as in. Writes have been filtered since drafts were
		 * introduced, so nothing in storage should carry a credential — but `sessionStorage`
		 * is caller-editable and a draft could equally predate the filter, and either way the
		 * cost of re-running it is a walk over an object that is about to be spread into form
		 * state anyway.
		 */
		return stripSensitiveFields(
			JSON.parse(storedDraft) as Record<string, unknown>,
		) as FormValuesType;
	} catch (error: unknown) {
		logger.warn('Discarding unreadable window draft', error, { uid });
		storage?.removeItem(draftKey(uid));

		return null;
	}
}

export function saveWindowDraft(uid: string, values: FormValuesType): void {
	const storage = getStorage();

	if (!storage) {
		return;
	}

	const safeValues = stripSensitiveFields(values as Record<string, unknown>);

	// Nothing left to keep (a form of nothing but credentials) — storing `{}` would
	// leave a key behind that says a form was being filled in, for no benefit
	if (Object.keys(safeValues).length === 0) {
		clearWindowDraft(uid);

		return;
	}

	try {
		storage.setItem(draftKey(uid), JSON.stringify(safeValues));
	} catch (error: unknown) {
		// Quota exceeded or serialization failure — never break the form over a draft
		logger.warn('Could not store window draft', error, { uid });
	}
}

export function clearWindowDraft(uid: string): void {
	getStorage()?.removeItem(draftKey(uid));
}

/** Used on logout and when the whole stack is closed. */
export function clearWindowDrafts(): void {
	const storage = getStorage();

	if (!storage) {
		return;
	}

	const draftKeys = Object.keys(storage).filter((key) =>
		key.startsWith(DRAFT_KEY_PREFIX),
	);

	for (const key of draftKeys) {
		storage.removeItem(key);
	}
}
