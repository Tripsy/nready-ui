'use client';

import isEqual from 'fast-deep-equal';
import type React from 'react';
import { useActionState, useMemo, useState } from 'react';
import { ActionButton } from '@/components/action-button.component';
import { FormComponentSubmit } from '@/components/form/form-element.component';
import { FormError } from '@/components/form/form-error.component';
import { createHandleChange } from '@/helpers/form.helper';
import { processForm } from '@/helpers/form-process.helper';
import {
	clearWindowDraft,
	readWindowDraft,
	saveWindowDraft,
} from '@/helpers/window-draft.helper';
import { useDebouncedEffect } from '@/hooks/use-debounced-effect.hook';
import { useWindowFormProcessed } from '@/hooks/use-form-processed.hook';
import { useFormSituation } from '@/hooks/use-form-situation.hook';
import { useFormValidation } from '@/hooks/use-form-validation.hook';
import { useFormValues } from '@/hooks/use-form-values.hook';
import { useTranslation } from '@/hooks/use-translation.hook';
import { WindowFormProvider } from '@/providers/window-form.provider';
import { useModalStore } from '@/stores/window.store';
import type { FormOperationFunctionType } from '@/types/action.type';
import type { FormStateType, FormValuesType } from '@/types/form.type';

type WindowFormType<Entry> = {
	uid: string;
	entry?: Entry;
	children: React.ReactElement;
};

export function WindowForm<
	FormValues extends FormValuesType,
	Entry extends Record<string, unknown>,
>({ uid, entry, children }: WindowFormType<Entry>) {
	const { getWindow, close } = useModalStore();

	const windowConfig = getWindow(uid);
	const windowDefinition = windowConfig?.definition;

	// Guards
	if (!windowConfig) {
		throw new Error(`Window config not found for uid: ${uid}`);
	}

	if (!windowDefinition) {
		throw new Error(`Window definition not found for uid: ${uid}`);
	}

	const {
		getFormState,
		getFormValues,
		validateForm,
		operationFunction: formOperationFunction,
		button: buttonSubmit,
	} = windowDefinition;

	const windowEvents = windowConfig.events;

	// + Guards
	if (!getFormState) {
		throw new Error(`getFormState not found for uid: ${uid}`);
	}

	if (!getFormValues) {
		throw new Error(`getFormValues not found for uid: ${uid}`);
	}

	if (!validateForm) {
		throw new Error(`validateForm not found for uid: ${uid}`);
	}

	if (!formOperationFunction) {
		throw new Error(`operationFunction not defined for window: ${uid}`);
	}

	// WindowForm only handles form operations.
	const operationFunction =
		formOperationFunction as FormOperationFunctionType<Entry, FormValues>;

	// Resolved once per mount: `useActionState` reads its initial state only on
	// mount, and `pristineValues` has to stay draft-free so an untouched form can
	// still be told apart from a restored one.
	const [{ initState, pristineValues }] = useState(() => {
		const formState = getFormState(entry);
		const draft = readWindowDraft(uid);

		return {
			pristineValues: formState.values,
			initState: draft
				? {
						...formState,
						values: {
							...formState.values,
							...draft,
						} as FormValues,
					}
				: formState,
		};
	});

	const entryId = entry && 'id' in entry ? (entry.id as number) : undefined; // Undefined for create

	const [state, action, pending] = useActionState<
		FormStateType<FormValues>,
		FormData
	>(
		async (state, formData) =>
			processForm(state, formData, {
				getFormValues,
				validateForm,
				operationFunction,
				entryId,
				// No CSRF token here: these forms are authenticated and covered by
				// the `Sec-Fetch-Site` / origin check in `src/proxy.ts`.
			}),
		initState,
	);

	const [formValues, setFormValues] = useFormValues<FormValues>(state.values);

	// Keeps edits across a page reload. Passwords are stripped by the helper, and a
	// form edited back to its original values drops the draft instead of storing a
	// no-op copy.
	useDebouncedEffect(
		() => {
			if (isEqual(formValues, pristineValues)) {
				clearWindowDraft(uid);

				return;
			}

			saveWindowDraft(uid, formValues);
		},
		[uid, formValues, pristineValues],
		500,
	);

	const { formSituation, formMessage, handleValidation } =
		useFormSituation<FormValues>(state);

	const {
		errors: formErrors,
		submitted,
		markSubmit,
		markFieldAsTouched,
	} = useFormValidation({
		formValues,
		validateForm,
		debounceDelay: 800,
		onValidation: handleValidation,
	});

	useWindowFormProcessed({
		state,
		windowConfig,
		windowEvents,
		entryId,
	});

	const translationsKeys = [
		'app.action.cancel.title',
		'app.action.cancel.label',
	] as const;

	const { translations } = useTranslation(translationsKeys);

	const handleChange = useMemo(
		() => createHandleChange<FormValues>(setFormValues, markFieldAsTouched),
		[setFormValues, markFieldAsTouched],
	);

	const handleClose = () => {
		close(uid);
		windowEvents?.close?.();
	};

	return (
		<WindowFormProvider
			value={{
				formOperation: windowConfig.action,
				formValues,
				errors: formErrors,
				handleChange,
				pending,
			}}
		>
			<form
				action={action}
				onSubmit={markSubmit}
				className="form-section"
			>
				{children}

				<div className="flex justify-end gap-3">
					<ActionButton
						action="abort"
						buttonAppearance={{
							variant: 'outline',
							hover: 'warning',
							title: translations['app.action.cancel.title'],
							icon: 'cancel',
							label: translations['app.action.cancel.label'],
						}}
						disabled={pending}
						command={{
							type: 'action',
							onClick: handleClose,
						}}
					/>
					<FormComponentSubmit
						pending={pending}
						submitted={submitted}
						error={formSituation === 'failedValidation'}
						button={buttonSubmit}
					/>
				</div>
				<FormError
					formSituation={formSituation}
					formMessage={formMessage}
				/>
			</form>
		</WindowFormProvider>
	);
}
