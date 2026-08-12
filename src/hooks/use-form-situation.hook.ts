import { useCallback, useRef, useState } from 'react';
import type {
	FormErrorsType,
	FormSituationType,
	FormValuesType,
} from '@/types/form.type';

type SituationSource = 'server' | 'client';

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

	const handleValidation = useCallback(
		(errors: FormErrorsType<FormValues>) => {
			const hasErrors = Object.keys(errors ?? {}).length > 0;

			if (hasErrors) {
				// Client takes over
				sourceRef.current = 'client';

				setFormSituation('failedValidation');
				setFormMessage(
					`${Object.keys(errors).length} field(s) need attention`,
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
