import type { JSX } from 'react';
import { ErrorIcon } from '@/components/status.component';
import type { FormSituationType } from '@/types/form.type';

export const FormError = <
	FormSituation extends string | null = FormSituationType,
>({
	formSituation,
	formMessage,
}: {
	formSituation: FormSituation;
	formMessage: string | null;
}): JSX.Element | null => {
	if (
		!formSituation ||
		!['serverError', 'failedValidation'].includes(formSituation)
	) {
		return null;
	}

	return (
		<div className="form-error">
			<ErrorIcon />
			<div>{formMessage}</div>
		</div>
	);
};
