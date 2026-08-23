'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
	useActionState,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from 'react';
import { complaintAction } from '@/components/complaint/complaint.action';
import {
	buildComplaintState,
	type ComplaintFormValuesType,
	type ComplaintSituationType,
	type ComplaintTranslations,
	complaintReasonLabelKey,
	validateFormComplaint,
} from '@/components/complaint/complaint.definition';
import {
	FormComponentRadio,
	FormComponentSubmit,
	FormComponentTextarea,
} from '@/components/form/form-element.component';
import { FormError } from '@/components/form/form-error.component';
import { Icons } from '@/components/icon.component';
import { Modal } from '@/components/ui/modal';
import Routes from '@/config/routes.setup';
import { getResponseData } from '@/helpers/api.helper';
import { cn } from '@/helpers/css.helper';
import { getErrorMessage } from '@/helpers/error.helper';
import { createHandleChange } from '@/helpers/form.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useFormSituation } from '@/hooks/use-form-situation.hook';
import { useFormValidation } from '@/hooks/use-form-validation.hook';
import { useFormValues } from '@/hooks/use-form-values.hook';
import type {
	ComplaintEntityType,
	ComplaintOwnEntryType,
	ComplaintPublicReadType,
	ComplaintReason,
} from '@/models/complaint.model';
import { useAuth } from '@/providers/auth.provider';
import { useToast } from '@/providers/toast.provider';
import {
	requestDeleteComplaint,
	requestOwnComplaint,
} from '@/services/complaint.service';

type ComplaintReportProps = {
	/** What is being reported — an article today, a comment next. */
	entityType: ComplaintEntityType;
	entityId: number;
	/**
	 * The reasons this target is offered, in the order they are shown. A subset of the backend
	 * enum: which of the seven make sense depends on what is being reported.
	 */
	reasons: readonly ComplaintReason[];
	translations: ComplaintTranslations;
};

/**
 * The form proper. It never resets itself: `useFormValidation` keeps `submitted` once a submit has
 * happened, so clearing the fields in place would immediately re-validate them as empty on a form
 * the reader has just used successfully. The dialog is closed on success instead, which unmounts
 * this and takes both with it.
 */
function ComplaintReportForm({
	entityType,
	entityId,
	reasons,
	translations,
	own,
	onReported,
	onWithdraw,
	withdrawing,
}: ComplaintReportProps & {
	/** What this reader already filed against the target, or null — the form amends it if so. */
	own: ComplaintOwnEntryType | null;
	onReported: () => void;
	onWithdraw: () => void;
	withdrawing: boolean;
}) {
	const [state, action, pending] = useActionState(
		complaintAction,
		buildComplaintState(entityType, entityId, own),
	);

	const [formValues, setFormValues] = useFormValues<ComplaintFormValuesType>(
		state.values,
	);

	const { formSituation, formMessage, handleValidation } = useFormSituation<
		ComplaintFormValuesType,
		ComplaintSituationType
	>(state);

	const { errors, submitted, markSubmit, markFieldAsTouched } =
		useFormValidation({
			formValues: formValues,
			validateForm: validateFormComplaint,
			debounceDelay: 800,
			onValidation: handleValidation,
		});

	const handleChange = createHandleChange(setFormValues, markFieldAsTouched);

	const elementIds = useElementIds(['reason', 'description'] as const);

	/*
	 * The reasons offered, plus whatever this reader filed under if that is not among them — a
	 * complaint made when the host offered a different set, or against a target whose set has
	 * since changed, would otherwise open with nothing selected and read as never filed.
	 */
	const options = (
		own && !reasons.includes(own.reason)
			? [own.reason, ...reasons]
			: reasons
	).map((reason) => ({
		value: reason,
		label: translations[complaintReasonLabelKey(reason)],
	}));

	useEffect(() => {
		if (formSituation === 'success') {
			onReported();
		}
	}, [formSituation, onReported]);

	return (
		<form action={action} onSubmit={markSubmit} className="form-section">
			{/* The request's shape, not the reader's input — see the definition. */}
			<input type="hidden" name="entity_type" value={entityType} />
			<input type="hidden" name="entity_id" value={entityId} />
			<input type="hidden" name="has_own" value={own ? '1' : '0'} />

			<p className="text-sm text-muted">{translations['report.intro']}</p>

			<FormComponentRadio<ComplaintFormValuesType>
				labelText={translations['report.reason']}
				id={elementIds.reason}
				fieldName="reason"
				fieldValue={formValues.reason}
				isRequired={true}
				disabled={pending || withdrawing}
				onChange={(value) =>
					handleChange('reason', value as ComplaintReason)
				}
				options={options}
				error={errors.reason}
			/>

			<FormComponentTextarea<ComplaintFormValuesType>
				labelText={translations['report.details']}
				id={elementIds.description}
				fieldName="description"
				fieldValue={formValues.description ?? ''}
				rows={4}
				placeholderText={translations['report.details_placeholder']}
				disabled={pending || withdrawing}
				onChange={(e) => handleChange('description', e.target.value)}
				error={errors.description}
			/>

			<div className="flex flex-wrap items-center gap-3">
				<FormComponentSubmit
					pending={pending}
					submitted={submitted}
					error={formSituation === 'failedValidation'}
					button={{
						label: own
							? translations['report.update']
							: translations['report.submit'],
					}}
				/>

				{/* Taking a report back is only offered once there is one to take back. */}
				{own && (
					<button
						type="button"
						onClick={onWithdraw}
						disabled={pending || withdrawing}
						className="text-sm text-danger hover:underline disabled:opacity-60"
					>
						{translations['report.withdraw']}
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
 * What this reader filed against one target, or null. Shared by the trigger and the dialog through
 * one query key, so a control that marks itself as "reported" and the dialog it opens cost a single
 * request between them.
 *
 * `staleTime: 0` against the provider's five-minute default: the answer is this reader's own
 * complaint, and it changes through this very dialog — a cached one would offer to file a report
 * they have just withdrawn. The backend does not cache it either (`ComplaintEntity.HAS_CACHE` is
 * false).
 */
function useOwnComplaint(
	entityType: ComplaintEntityType,
	entityId: number,
	enabled: boolean,
) {
	// Memoized because the callbacks below invalidate it: a key rebuilt each render would make
	// every one of them a new function, and remount the form they are passed to.
	const queryKey = useMemo(
		() => ['complaint', entityType, entityId],
		[entityType, entityId],
	);

	const { data } = useQuery({
		queryKey,
		queryFn: async () => {
			const response = await requestOwnComplaint(entityType, entityId);

			return (
				getResponseData<ComplaintPublicReadType>(response)?.own ?? null
			);
		},
		enabled,
		staleTime: 0,
	});

	return { own: data ?? null, queryKey };
}

/**
 * The dialog on its own, for a host that already has somewhere to open it from — a menu item, a
 * row action — rather than the trigger below.
 *
 * Reporting needs an account: `user_id` is `NOT NULL` on the backend's table and every public
 * complaint endpoint answers 401 without a session, so a signed-out reader is shown the way to
 * sign in rather than a form that cannot be submitted. Which is also why the read is `enabled` on
 * the session — and on the dialog being open, so a page rendering one of these per row does not
 * ask about every one of them on arrival.
 */
export function ComplaintReportDialog({
	entityType,
	entityId,
	reasons,
	translations,
	isOpen,
	onClose,
}: ComplaintReportProps & {
	isOpen: boolean;
	onClose: () => void;
}) {
	const { auth } = useAuth();
	const pathname = usePathname();
	const queryClient = useQueryClient();
	const { showToast } = useToast();

	const isMember = Boolean(auth?.id);

	const { own, queryKey } = useOwnComplaint(
		entityType,
		entityId,
		isMember && isOpen,
	);

	const onReported = useCallback(() => {
		showToast({
			severity: 'success',
			summary: translations['report.success'],
		});

		queryClient.invalidateQueries({ queryKey });
		onClose();
	}, [queryKey, queryClient, showToast, translations, onClose]);

	const { mutate: withdraw, isPending: withdrawing } = useMutation({
		mutationFn: () => requestDeleteComplaint(entityType, entityId),
		onSuccess: () => {
			showToast({
				severity: 'success',
				summary: translations['report.withdraw_success'],
			});

			queryClient.invalidateQueries({ queryKey });
			onClose();
		},
		onError: (error) =>
			showToast({
				severity: 'error',
				summary: translations['report.withdraw_failed'],
				// The backend's own wording, which distinguishes a complaint already
				// decided on from one that is no longer there.
				detail: getErrorMessage(error),
			}),
	});

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title={translations['report.title']}
			size="lg"
		>
			<div className="pb-4">
				{!isMember ? (
					<div className="space-y-3">
						<p className="text-sm text-muted">
							{translations['report.guest']}
						</p>

						{/* The reader lands back where they were reading, which is the
						    only place the report makes sense. */}
						<Link
							href={`${Routes.get('login')}?from=${encodeURIComponent(pathname)}`}
							className="text-sm text-accent hover:underline"
						>
							{translations['report.sign_in']}
						</Link>
					</div>
				) : own?.is_resolved ? (
					/*
					 * A decided complaint is the record the decision is answered from, so the
					 * backend refuses both an amendment and a withdrawal — there is nothing to
					 * offer but what was reported.
					 */
					<div className="space-y-2">
						<p className="text-sm text-muted">
							{translations['report.resolved']}
						</p>

						<p className="text-sm font-medium">
							{translations[complaintReasonLabelKey(own.reason)]}
						</p>

						{own.description && (
							<p className="text-sm text-muted whitespace-pre-line">
								{own.description}
							</p>
						)}
					</div>
				) : (
					/*
					 * Keyed on the complaint being amended: the form seeds its action state from
					 * `own` once, so a report filed or withdrawn in another tab has to remount it
					 * rather than leave the previous values behind.
					 */
					<ComplaintReportForm
						key={own?.id ?? 'new'}
						entityType={entityType}
						entityId={entityId}
						reasons={reasons}
						translations={translations}
						own={own}
						onReported={onReported}
						onWithdraw={withdraw}
						withdrawing={withdrawing}
					/>
				)}
			</div>
		</Modal>
	);
}

/**
 * The report control as it sits beside what it reports on: a trigger carrying the state, and the
 * dialog above. A host with its own trigger renders `ComplaintReportDialog` directly instead.
 */
export function ComplaintReport(props: ComplaintReportProps) {
	const { auth } = useAuth();
	const [isOpen, setIsOpen] = useState(false);

	const { own } = useOwnComplaint(
		props.entityType,
		props.entityId,
		Boolean(auth?.id),
	);

	const close = useCallback(() => setIsOpen(false), []);

	return (
		<>
			<button
				type="button"
				onClick={() => setIsOpen(true)}
				title={props.translations['report.action']}
				className={cn(
					'flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm transition-colors',
					// A report already filed keeps the control marked, so the state reads
					// without opening the dialog.
					own
						? 'border-warning text-warning'
						: 'text-muted hover:bg-accent-soft hover:text-accent-soft-foreground',
				)}
			>
				<Icons.Action.Flag className="h-4 w-4" />
				{own
					? props.translations['report.reported']
					: props.translations['report.action']}
			</button>

			<ComplaintReportDialog {...props} isOpen={isOpen} onClose={close} />
		</>
	);
}
