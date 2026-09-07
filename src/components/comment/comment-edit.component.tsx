/*
 * No `'use client'`: `comment-thread.component.tsx` is the boundary that mounts this, and
 * everything a client module imports is already in the client graph. Next's TS plugin treats
 * any file carrying the directive as a client *entry* and then rejects the non-serializable
 * props below (TS71007) - `onSaved` and `onCancel` are plain callbacks, not server actions.
 */
import { useMutation } from '@tanstack/react-query';
import type React from 'react';
import { useCallback, useState } from 'react';
import {
	COMMENT_CONTENT_MAX,
	COMMENT_CONTENT_MIN,
	type CommentTranslations,
} from '@/components/comment/comment.definition';
import { FormComponentTextarea } from '@/components/form/form-element.component';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/helpers/error.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useToast } from '@/providers/toast.provider';
import {
	requestModerateComment,
	requestUpdateComment,
} from '@/services/comment.service';

/**
 * Editing one comment in place, in the thread it sits in.
 *
 * A `useMutation` rather than the `processForm` pipeline the comment box uses: this is one field
 * with no identity to establish and no target to carry, and the action-host shape (`forms.md` §7)
 * would be a `<name>.action.ts`, a form-values contract and a validator around a single textarea.
 * Secondary inline actions are what `useMutation` is for (`data-fetching.md` §1).
 *
 * The row is replaced by this editor rather than opened beside it - a comment and a draft of the
 * same comment on screen at once is two versions of one thing, and the reader has to work out
 * which one is live.
 */
export function CommentEdit({
	entry,
	isOwn,
	translations,
	onSaved,
	onCancel,
}: {
	entry: { id: number; content: string };
	/**
	 * Which endpoint the save goes to. An author edits through the public route, which needs no
	 * permission and narrows to their own row; anybody else is a moderator going through the
	 * dashboard route. A moderator editing their *own* comment takes the public path too - it is
	 * the one that asks for nothing they might not have.
	 */
	isOwn: boolean;
	translations: CommentTranslations;
	onSaved: () => void;
	onCancel: () => void;
}) {
	const { showToast } = useToast();

	const [content, setContent] = useState(entry.content);
	const [touched, setTouched] = useState(false);

	const elementIds = useElementIds(['content'] as const);

	const trimmed = content.trim();

	// The bounds the backend holds. Checked here so the length is not something a reader learns
	// from a rejected request, and re-checked there because this one is only a courtesy.
	const isValid =
		trimmed.length >= COMMENT_CONTENT_MIN &&
		trimmed.length <= COMMENT_CONTENT_MAX;

	const { mutate: save, isPending } = useMutation({
		mutationFn: () =>
			isOwn
				? requestUpdateComment(entry.id, { content: trimmed })
				: requestModerateComment(entry.id, { content: trimmed }),
		onSuccess: () => {
			showToast({
				severity: 'success',
				summary: translations['thread.edit_success'],
			});

			onSaved();
		},
		onError: (error) =>
			showToast({
				severity: 'error',
				summary: translations['thread.edit_failed'],
				/*
				 * The backend's own wording, and worth showing: a 400 here says the comment has
				 * been moderated since the page was loaded, which is the one outcome the reader
				 * can neither predict nor fix by retyping.
				 */
				detail: getErrorMessage(error),
			}),
	});

	const onSubmit = useCallback(
		(event: React.SubmitEvent) => {
			event.preventDefault();

			setTouched(true);

			if (isValid && !isPending) {
				save();
			}
		},
		[isValid, isPending, save],
	);

	return (
		<form onSubmit={onSubmit} className="mt-2">
			<FormComponentTextarea<{ content: string }>
				id={elementIds.content}
				fieldName="content"
				fieldValue={content}
				isRequired={true}
				rows={4}
				placeholderText={translations['form.content_placeholder']}
				disabled={isPending}
				onChange={(event) => {
					setContent(event.target.value);
					setTouched(true);
				}}
				// Only once the reader has typed: an editor that opens with the field already
				// marked red is reporting on text it was handed, not on anything they did.
				error={
					touched && !isValid
						? [translations['validation.invalid_content']]
						: undefined
				}
			/>

			{/* `mt-3` - the textarea sits flush against its own border, so without it the two
			    controls touch the field they belong to. */}
			<div className="mt-3 flex flex-wrap items-center gap-3">
				<Button type="submit" disabled={isPending || !isValid}>
					{translations['thread.edit_save']}
				</Button>

				<Button
					type="button"
					variant="ghost"
					onClick={onCancel}
					disabled={isPending}
					className="text-sm text-muted transition-colors hover:text-foreground"
				>
					{translations['thread.cancel']}
				</Button>
			</div>
		</form>
	);
}
