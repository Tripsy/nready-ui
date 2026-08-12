import { useCallback, useState } from 'react';
import {
	accumulateZodErrors,
	filterErrorsByTouched,
} from '@/helpers/form.helper';
import { getObjectValue, setNestedValue } from '@/helpers/objects.helper';
import { useDebouncedEffect } from '@/hooks/use-debounced-effect.hook';
import type {
	FormErrorsType,
	FormValuesType,
	TouchedFieldsType,
	ValidateFormFnType,
} from '@/types/form.type';

type UseFormValidationProps<FormValues extends FormValuesType> = {
	formValues: FormValues;
	validateForm: ValidateFormFnType<FormValues>;
	debounceDelay?: number;
	onValidation: (errors: FormErrorsType<FormValues>) => void;
};

export function useFormValidation<FormValues extends FormValuesType>({
	formValues,
	validateForm,
	debounceDelay = 800,
	onValidation,
}: UseFormValidationProps<FormValues>) {
	const [errors, setErrors] = useState<FormErrorsType<FormValues>>({});
	const [touchedFields, setTouchedFields] = useState<
		TouchedFieldsType<FormValues>
	>({});
	const [submitted, setSubmitted] = useState(false);

	const markFieldAsTouched = useCallback((path: string) => {
		setTouchedFields((prev) => {
			if (getObjectValue(prev, path)) {
				return prev;
			}

			return setNestedValue(prev, path, true);
		});
	}, []);

	const markSubmit = useCallback(() => {
		setSubmitted(true);
	}, []);

	useDebouncedEffect(
		async () => {
			const shouldValidate =
				submitted || Object.keys(touchedFields).length > 0;

			if (!shouldValidate) {
				return;
			}

			const result = await validateForm(formValues, false);

			if (result.success) {
				setErrors({});
				onValidation({});
				return;
			}

			const allErrors = accumulateZodErrors<FormValues>(result.error);

			if (submitted) {
				setErrors(allErrors);
				onValidation(allErrors);
				return;
			}

			const filteredErrors = filterErrorsByTouched(
				allErrors,
				touchedFields,
			);
			setErrors(filteredErrors);
			onValidation(filteredErrors);
		},
		[formValues, touchedFields, submitted, validateForm],
		debounceDelay,
	);

	return {
		errors,
		setErrors,
		touchedFields,
		markFieldAsTouched,
		submitted,
		markSubmit,
	};
}
