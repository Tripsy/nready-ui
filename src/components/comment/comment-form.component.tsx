import { useActionState, useCallback, useEffect, useState } from 'react';
import { commentAction } from '@/components/comment/comment.action';
import {
	buildCommentState,
	type CommentFormValuesType,
	type CommentSituationType,
	type CommentTranslations,
	validateFormComment,
} from '@/components/comment/comment.definition';
import {
	FormComponentInput,
	FormComponentSubmit,
	FormComponentTextarea,
} from '@/components/form/form-element.component';
import { FormError } from '@/components/form/form-error.component';
import { createHandleChange } from '@/helpers/form.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useFormSituation } from '@/hooks/use-form-situation.hook';
import { useFormValidation } from '@/hooks/use-form-validation.hook';
import { useFormValues } from '@/hooks/use-form-values.hook';
import type { CommentEntityType } from '@/models/comment.model';
import { useAuth } from '@/providers/auth.provider';

type CommentFormProps = {
	/** What is being commented on — an article today, a review next. */
	entityType: CommentEntityType;
	entityId: number;
	/** The comment being answered, or null for a new thread. */
	parentId?: number | null;
	translations: CommentTranslations;
	/** Invalidates the thread; a reply form also closes itself. */
	onSuccess?: () => void;
	onCancel?: () => void;
};

/**
 * The form proper. It never resets itself: `useFormValidation` keeps `submitted` once a submit
 * has happened, so clearing the body in place would immediately re-validate it as empty and
 * paint the field red on a form the reader has just successfully used. `CommentForm`
 * remounts this instead, which is the only thing that clears both at once.
 */
function CommentFormFields({
	entityType,
	entityId,
	parentId = null,
	translations,
	onPosted,
	onCancel,
}: Omit<CommentFormProps, 'onSuccess'> & {
	onPosted: (message: string | null) => void;
}) {
	const { auth } = useAuth();

	/*
	 * Whether the name and email fields are asked for at all. Resolved on the client, so it
	 * settles only once the session has been read — the backend decides for itself either way,
	 * and rejects a guest who sent neither.
	 */
	const requiresGuest = !auth?.id;

	const [state, action, pending] = useActionState(
		commentAction,
		buildCommentState(entityType, entityId, parentId, requiresGuest),
	);

	const [formValues, setFormValues] = useFormValues<CommentFormValuesType>(
		state.values,
	);

	const { formSituation, formMessage, handleValidation } = useFormSituation<
		CommentFormValuesType,
		CommentSituationType
	>(state);

	const { errors, submitted, markSubmit, markFieldAsTouched } =
		useFormValidation({
			formValues: formValues,
			validateForm: validateFormComment,
			debounceDelay: 800,
			onValidation: handleValidation,
		});

	const handleChange = createHandleChange(setFormValues, markFieldAsTouched);

	const elementIds = useElementIds([
		'content',
		'guest_name',
		'guest_email',
		'guest_website',
	] as const);

	/*
	 * What the reader is told is the backend's own wording, passed up rather than chosen here: a
	 * member's comment is usually public the moment it is written while a guest's waits for a
	 * moderator, and only the response knows which of the two happened. The local copy is the
	 * fallback for a response that carries no message, so it says neither.
	 */
	useEffect(() => {
		if (formSituation === 'success') {
			onPosted(formMessage);
		}
	}, [formSituation, formMessage, onPosted]);

	return (
		<form
			action={action}
			onSubmit={markSubmit}
			className="form-section mt-4"
		>
			{/* The request's shape, not the reader's input — see the definition. */}
			<input type="hidden" name="entity_type" value={entityType} />
			<input type="hidden" name="entity_id" value={entityId} />
			<input type="hidden" name="parent_id" value={parentId ?? ''} />
			<input
				type="hidden"
				name="requires_guest"
				value={requiresGuest ? '1' : '0'}
			/>

			{/*
			 * No label: the section it sits in already says what this box is, and the
			 * placeholder names it for a screen reader (see `FormComponentTextarea`).
			 */}
			<FormComponentTextarea<CommentFormValuesType>
				id={elementIds.content}
				fieldName="content"
				fieldValue={formValues.content ?? ''}
				isRequired={true}
				rows={parentId ? 3 : 5}
				placeholderText={translations['form.content_placeholder']}
				disabled={pending}
				onChange={(e) => handleChange('content', e.target.value)}
				error={errors.content}
			/>

			{requiresGuest && (
				<div className="grid gap-4 sm:grid-cols-2">
					<FormComponentInput<CommentFormValuesType>
						labelText={translations['form.guest_name']}
						id={elementIds.guest_name}
						fieldName="guest_name"
						fieldValue={formValues.guest_name ?? ''}
						isRequired={true}
						disabled={pending}
						onChange={(e) =>
							handleChange('guest_name', e.target.value)
						}
						error={errors.guest_name}
					/>

					<FormComponentInput<CommentFormValuesType>
						labelText={translations['form.guest_email']}
						id={elementIds.guest_email}
						fieldName="guest_email"
						fieldType="email"
						fieldValue={formValues.guest_email ?? ''}
						isRequired={true}
						autoComplete="email"
						disabled={pending}
						onChange={(e) =>
							handleChange('guest_email', e.target.value)
						}
						error={errors.guest_email}
					/>

					<FormComponentInput<CommentFormValuesType>
						labelText={translations['form.guest_website']}
						id={elementIds.guest_website}
						fieldName="guest_website"
						fieldValue={formValues.guest_website ?? ''}
						disabled={pending}
						onChange={(e) =>
							handleChange('guest_website', e.target.value)
						}
						error={errors.guest_website}
					/>

					{/* The address is never published — the reader has no way to know that
					    unless the form says so. */}
					<p className="self-end text-xs text-muted sm:col-span-1">
						{translations['form.guest_email_note']}
					</p>
				</div>
			)}

			<div className="flex flex-wrap items-center gap-3">
				<FormComponentSubmit
					pending={pending}
					submitted={submitted}
					error={formSituation === 'failedValidation'}
					button={{ label: translations['form.submit'] }}
				/>

				{onCancel && (
					<button
						type="button"
						onClick={onCancel}
						disabled={pending}
						className="text-sm text-muted hover:text-foreground transition-colors disabled:opacity-60"
					>
						{translations['thread.cancel']}
					</button>
				)}
			</div>

			<FormError
				formSituation={formSituation}
				formMessage={formMessage}
			/>
		</form>
	);
}

/**
 * The comment box: the form, or the confirmation that replaces it once something has been
 * posted. A reply form is unmounted by its parent on success, so the confirmation below is what
 * the root form shows.
 */
export function CommentForm({ onSuccess, ...props }: CommentFormProps) {
	const [posted, setPosted] = useState<{ message: string | null } | null>(
		null,
	);
	// Bumped to remount the form, which is what clears its action state and its validation.
	const [attempt, setAttempt] = useState(0);

	const onPosted = useCallback(
		(message: string | null) => {
			setPosted({ message });
			onSuccess?.();
		},
		[onSuccess],
	);

	const onWriteAnother = useCallback(() => {
		setPosted(null);
		setAttempt((current) => current + 1);
	}, []);

	if (posted) {
		return (
			<div className="mt-4 space-y-3">
				{/* The backend's wording where there is one — it is the half that knows whether
				    the comment is already on the page or waiting for a moderator. */}
				<p className="text-sm text-success">
					{posted.message || props.translations['form.success']}
				</p>

				<button
					type="button"
					onClick={onWriteAnother}
					className="text-sm text-accent hover:underline"
				>
					{props.translations['form.write_another']}
				</button>
			</div>
		);
	}

	return <CommentFormFields key={attempt} {...props} onPosted={onPosted} />;
}
