import { useCallback, useEffect, useRef, useState } from 'react';
import { translateLoaded } from '@/config/translate.setup';
import { useDocumentLanguage } from '@/hooks/use-document-language.hook';
import type {
	FormErrorsType,
	FormSituationType,
	FormValuesType,
} from '@/types/form.type';

type SituationSource = 'server' | 'client';

const FIELDS_NEED_ATTENTION_KEY = 'app.error.fields_need_attention';

export function useFormSituation<
	FormValues extends FormValuesType,
	FormSituation extends string | null = FormSituationType,
>(state: { situation: FormSituation; message: string | null }) {
	const [formSituation, setFormSituation] = useState<
		FormSituation | FormSituationType
	>(state.situation);
	const [formMessage, setFormMessage] = useState<string | null>(
		state.message,
	);

	const prevStateRef = useRef(state);
	const sourceRef = useRef<SituationSource>('server');

	// Server state changed — server always wins
	if (prevStateRef.current !== state) {
		prevStateRef.current = state;
		sourceRef.current = 'server';

		setFormSituation(state.situation);
		setFormMessage(state.message);
	}

	const language = useDocumentLanguage();
	const previousLanguageRef = useRef(language);

	/*
	 * A server message is a resolved string, not a key: `processForm` translates it inside the
	 * action and hands back finished text. A later language change re-renders the page but
	 * cannot re-translate what is already sitting in this state, so the message would linger in
	 * the previous language. Some of those messages come verbatim from the backend and have no
	 * key to re-resolve from, so dropping it is the only answer that holds for all of them.
	 *
	 * Client messages need no such treatment — `handleValidation` re-resolves them on the next
	 * validation run, which `useFormValidation` triggers off the same language value.
	 *
	 * `success` is exempt: a flow may already be acting on it (the login redirect reads it from
	 * an effect), and clearing it mid-flight would strand that caller.
	 */
	useEffect(() => {
		const previousLanguage = previousLanguageRef.current;

		previousLanguageRef.current = language;

		// The empty string is the pre-hydration snapshot, not a language the user was reading
		// in — treating it as one would wipe a server message on the first commit.
		if (!previousLanguage || previousLanguage === language) {
			return;
		}

		setFormSituation((current) => (current === 'success' ? current : null));
		setFormMessage(null);
	}, [language]);

	const handleValidation = useCallback(
		(errors: FormErrorsType<FormValues>) => {
			const errorCount = Object.keys(errors ?? {}).length;

			if (errorCount > 0) {
				// Client takes over
				sourceRef.current = 'client';

				setFormSituation('failedValidation');
				// Resolved per call rather than once, so the count is current and the text
				// follows the language in effect when the validation actually ran. Falls back
				// to the key when the locale resource has not loaded yet, which is what every
				// other lookup in the app does.
				setFormMessage(
					translateLoaded(FIELDS_NEED_ATTENTION_KEY, {
						count: errorCount,
					}) ?? FIELDS_NEED_ATTENTION_KEY,
				);
			} else if (sourceRef.current === 'client') {
				// Only clear if client set it — never touch server-owned state
				sourceRef.current = 'client'; // stay client-owned until next server response

				setFormSituation(null);
				setFormMessage(null);
			}
		},
		[],
	);

	return { formSituation, formMessage, handleValidation };
}
