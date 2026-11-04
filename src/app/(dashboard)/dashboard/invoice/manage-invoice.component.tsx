'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
	BillingDetailsFields,
	isPartyIncomplete,
	SellerDetailsFields,
} from '@/app/(dashboard)/dashboard/invoice/invoice-party-fields.component';
import {
	FormComponentCalendar,
	FormComponentTextarea,
} from '@/components/form/form-element.component';
import { Icons } from '@/components/icon.component';
import {
	ErrorComponent,
	LoadingComponent,
} from '@/components/status.component';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/exceptions/api.error';
import { toCalendarValue } from '@/helpers/date.helper';
import { DisplayAmount } from '@/helpers/display.helper';
import type { ValidationIssueType } from '@/helpers/form.helper';
import { requestUpdate, requestView } from '@/helpers/services.helper';
import { replaceVars } from '@/helpers/string.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useTranslation } from '@/hooks/use-translation.hook';
import {
	type BillingDetails,
	computeInvoiceLineTotal,
	type InvoiceLineModel,
	type InvoiceModel,
	InvoiceScopeEnum,
	InvoiceStatusEnum,
	type SellerDetails,
} from '@/models/invoice.model';
import { useToast } from '@/providers/toast.provider';

const TRANSLATION_KEYS = [
	'invoice.field.discount_reduction',
	'invoice.field.due_at',
	'invoice.field.label',
	'invoice.field.notes',
	'invoice.field.quantity',
	'invoice.field.total_gross',
	'invoice.text.add_another_line',
	'invoice.text.discard_this_line',
	'invoice.text.label_add_another_line',
	'invoice.text.label_discard_new_line',
	'invoice.text.label_discount_of',
	'invoice.text.label_label_of',
	'invoice.text.label_quantity_of',
	'invoice.text.label_unit_price_of',
	'invoice.text.label_vat_rate_of',
	'invoice.text.lines',
	'invoice.text.placeholder_due_at',
	'invoice.text.save',
	'invoice.text.this_document_has_been_issued_so',
	'invoice.text.this_document_itemizes_nothing_yet',
	'invoice.text.unit_price',
	'invoice.text.vat',
	'app.success.title',
	'app.error.title',
	'invoice.text.updated',
	'invoice.text.no_billing_address',
	'invoice.text.label_keep_line',
	'invoice.text.label_remove_line',
	'invoice.text.keep_line',
	'invoice.text.remove_on_save',
	'invoice.text.quantity_over',
	'invoice.text.price_over',
	'invoice.text.described_line',
	'invoice.text.described_new_line',
	'invoice.text.described_the_new_line',
	'invoice.text.add_line_hint',
	'invoice.text.add_adjustment_hint',
	'invoice.text.placeholder_custom_line',
	'invoice.text.placeholder_adjustment_line',
] as const;

type TranslationsType = Record<(typeof TRANSLATION_KEYS)[number], string>;

/**
 * What a draft accepts beyond its lines. The figures are not here: they come from the lines, and
 * the currency cannot move at all - every stored amount is quoted in it.
 */
type DetailsDraft = {
	due_at: string | null;
	notes: string | null;
};

/** The four figures a line may be restated by; the API derives the rest. */
type LineDraft = {
	label: string;
	quantity: string;
	unit_price: string;
	vat_rate: string;
	discount_reduction: string;
};

/**
 * What a refused write says, beyond its headline. A 422 answers `Check errors` and puts the real
 * complaint in the envelope's `errors`, which the response type does not model - so the field
 * messages are read defensively and joined onto the toast. A 4xx rejects as an `ApiError` carrying
 * that envelope in `body`.
 */
function describeRefusal(response: {
	message: string;
	errors?: unknown;
}): string {
	const issues = Array.isArray(response.errors)
		? (response.errors as ValidationIssueType[])
		: [];

	const details = issues
		.filter((issue) => typeof issue?.message === 'string')
		.map((issue) =>
			issue.path?.length
				? `${issue.path.join('.')}: ${issue.message}`
				: issue.message,
		);

	return details.length > 0
		? `${response.message} - ${details.join('; ')}`
		: response.message;
}

/** One line as `update` takes it: with `id` a line restated, without one a new adjustment. */
type LineParams = {
	id?: number;
	label: string;
	quantity: number;
	unit_price: number;
	vat_rate: number;
	discount_reduction: number;
};

/**
 * What a single save sends: the header, the whole set of lines the draft should read, and a party
 * only when it was touched - stated by hand, or `null` to hand it back to issuing.
 */
type InvoiceSaveParams = DetailsDraft & {
	lines: LineParams[];
	billing_details?: BillingDetails | null;
	seller_details?: SellerDetails | null;
};

function toLineParams(draft: LineDraft, id?: number): LineParams {
	return {
		...(id === undefined ? {} : { id: id }),
		label: draft.label.trim(),
		quantity: Number(draft.quantity),
		unit_price: Number(draft.unit_price),
		vat_rate: Number(draft.vat_rate),
		discount_reduction: Number(draft.discount_reduction),
	};
}

/** A line the API would refuse outright: no label, or a figure left blank. */
function isIncomplete(draft: LineDraft): boolean {
	return (
		draft.label.trim() === '' ||
		draft.quantity.trim() === '' ||
		draft.unit_price.trim() === ''
	);
}

/** What the add-line row starts from; a quantity of one is what most corrections carry. */
const EMPTY_LINE: LineDraft = {
	label: '',
	quantity: '1',
	unit_price: '',
	vat_rate: '0',
	discount_reduction: '0',
};

function toDetailsDraft(invoice: InvoiceModel): DetailsDraft {
	return {
		// The calendar field reads `YYYY-MM-DD` and nothing else - `parseDate` throws on a full
		// ISO timestamp, which is what the document carries
		due_at: toCalendarValue(invoice.due_at ?? null),
		notes: invoice.notes ?? null,
	};
}

function toDraft(line: InvoiceLineModel): LineDraft {
	return {
		label: line.label,
		quantity: String(line.quantity),
		unit_price: String(line.unit_price),
		vat_rate: String(line.vat_rate),
		discount_reduction: String(line.discount_reduction),
	};
}

/*
 * One column template for the header, every line and the add row, so the three stay aligned
 * whatever a cell holds. The literal class strings are what Tailwind scans for.
 */
const LINE_GRID =
	'grid grid-cols-[minmax(8rem,1fr)_4.5rem_6rem_4.5rem_5.5rem_6.5rem] items-center gap-2';
const LINE_GRID_DRAFT =
	'grid grid-cols-[minmax(8rem,1fr)_4.5rem_6rem_4.5rem_5.5rem_6.5rem_2.25rem] items-center gap-2';

/**
 * The five editable cells of a line, shared by the existing lines, the lines added in this window
 * and the add row. `figuresDisabled` locks the four numbers but not the label - a reversal's
 * figures follow the invoice it reverses.
 */
function LineInputs({
	translations,
	draft,
	describedAs,
	disabled,
	figuresDisabled = disabled,
	isStruck = false,
	labelPlaceholder,
	maxQuantity,
	maxUnitPrice,
	isQuantityOver = false,
	isPriceOver = false,
	onChange,
}: {
	translations: TranslationsType;
	draft: LineDraft;
	describedAs: string;
	disabled: boolean;
	figuresDisabled?: boolean;
	isStruck?: boolean;
	labelPlaceholder?: string;
	maxQuantity?: number | null;
	maxUnitPrice?: number | null;
	isQuantityOver?: boolean;
	isPriceOver?: boolean;
	onChange: (field: keyof LineDraft, value: string) => void;
}) {
	return (
		<>
			<Input
				aria-label={replaceVars(
					translations['invoice.text.label_label_of'],
					{ described_as: describedAs },
				)}
				className={isStruck ? 'line-through' : undefined}
				placeholder={labelPlaceholder}
				value={draft.label}
				disabled={disabled}
				onChange={(event) => onChange('label', event.target.value)}
			/>

			<Input
				aria-label={replaceVars(
					translations['invoice.text.label_quantity_of'],
					{ described_as: describedAs },
				)}
				type="number"
				max={maxQuantity ?? undefined}
				aria-invalid={isQuantityOver}
				value={draft.quantity}
				disabled={figuresDisabled}
				onChange={(event) => onChange('quantity', event.target.value)}
			/>

			<Input
				aria-label={replaceVars(
					translations['invoice.text.label_unit_price_of'],
					{ described_as: describedAs },
				)}
				type="number"
				max={maxUnitPrice ?? undefined}
				aria-invalid={isPriceOver}
				value={draft.unit_price}
				disabled={figuresDisabled}
				onChange={(event) => onChange('unit_price', event.target.value)}
			/>

			<Input
				aria-label={replaceVars(
					translations['invoice.text.label_vat_rate_of'],
					{ described_as: describedAs },
				)}
				type="number"
				value={draft.vat_rate}
				disabled={figuresDisabled}
				onChange={(event) => onChange('vat_rate', event.target.value)}
			/>

			<Input
				aria-label={replaceVars(
					translations['invoice.text.label_discount_of'],
					{ described_as: describedAs },
				)}
				type="number"
				value={draft.discount_reduction}
				disabled={figuresDisabled}
				onChange={(event) =>
					onChange('discount_reduction', event.target.value)
				}
			/>
		</>
	);
}

/**
 * What the line totals as it is being typed, worked out the way the API stores it. A dash while
 * the figures do not make a line - a blank field, or a discount larger than the line value.
 */
function LineTotal({
	draft,
	currency,
}: {
	draft: LineDraft;
	currency: string;
}) {
	const total = computeInvoiceLineTotal({
		quantity: Number(draft.quantity),
		unit_price: Number(draft.unit_price),
		vat_rate: Number(draft.vat_rate),
		discount_reduction: Number(draft.discount_reduction),
	});

	return (
		<div className="text-right">
			{draft.quantity.trim() === '' ||
			draft.unit_price.trim() === '' ||
			total === null ? (
				'-'
			) : (
				<DisplayAmount amount={total} currencyCode={currency} />
			)}
		</div>
	);
}

/**
 * Everything a draft accepts, saved together: its due date and notes, and its lines - restated,
 * added or marked for removal. Nothing is written until Save, which sends the header and the
 * whole line set in one `update`; the API applies it in one transaction, so a refusal leaves the
 * draft exactly as it was and every edit here stays in place to be corrected.
 *
 * Read through `read` rather than from the row the table hands over: the listing carries no lines,
 * and the read is what reports each line's caps. A save re-reads the document, because the API
 * re-sums the totals behind it.
 *
 * Drafts only, so nothing here has to answer for an issued document: the action that opens it is
 * gated the same way, and the API refuses any write once the document has left `draft`.
 */
export function ManageInvoice({ entries }: { entries: InvoiceModel[] }) {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const entry = entries[0];

	const queryClient = useQueryClient();
	const { showToast } = useToast();

	const elementIds = useElementIds(['dueAt', 'notes'] as const);

	const [details, setDetails] = useState<DetailsDraft | null>(null);
	const [drafts, setDrafts] = useState<Record<number, LineDraft>>({});
	const [removedIds, setRemovedIds] = useState<Set<number>>(new Set());
	const [added, setAdded] = useState<{ key: number; draft: LineDraft }[]>([]);
	const [newLine, setNewLine] = useState<LineDraft>(EMPTY_LINE);
	// `undefined` while untouched; `null` once the operator asked for the automatic details back
	const [billingDraft, setBillingDraft] = useState<
		BillingDetails | null | undefined
	>(undefined);
	const [sellerDraft, setSellerDraft] = useState<
		SellerDetails | null | undefined
	>(undefined);
	const [isSaving, setIsSaving] = useState(false);

	const queryKey = ['invoice', 'detail', entry.id];

	const {
		data: invoice,
		isLoading,
		error,
		refetch,
	} = useQuery({
		queryKey: queryKey,
		queryFn: async () => {
			const response = await requestView<InvoiceModel>(
				'invoice',
				entry.id,
			);

			if (!response) {
				throw new Error('Could not retrieve the invoice');
			}

			return response;
		},
	});

	if (isLoading) {
		return <LoadingComponent />;
	}

	if (error || !invoice) {
		return <ErrorComponent description={(error as Error)?.message} />;
	}

	const lines = invoice.lines ?? [];
	const isDraft = invoice.status === InvoiceStatusEnum.DRAFT;
	const gridClass = isDraft ? LINE_GRID_DRAFT : LINE_GRID;
	const isEditable = isDraft && !isSaving;

	// A reversal takes back lines of its original and nothing else, so it takes no new line and
	// its figures stay as raised - the API refuses both
	const canAddLines = isDraft && !invoice.is_reversal;

	// A custom invoice is nothing but the lines written here, so they are its charges rather than
	// corrections to an order's
	const isCustomInvoice = invoice.scope === InvoiceScopeEnum.CUSTOM;

	const currentDetails = details ?? toDetailsDraft(invoice);

	/*
	 * The parties. What is stored on the draft was stated by hand - except on a document raised
	 * from a bare cash flow entry, which was given its buyer when it was raised and has no order
	 * to resolve one from, so there is nothing automatic to go back to. Otherwise the form starts
	 * from what issuing would freeze.
	 */
	const resolvedBilling = invoice.resolved_billing_details ?? null;
	const resolvedSeller = invoice.resolved_seller_details ?? null;
	const canResolveBilling = invoice.order_id !== null;

	const shownBilling =
		billingDraft === undefined
			? (invoice.billing_details ?? resolvedBilling)
			: (billingDraft ?? resolvedBilling);
	const shownSeller =
		sellerDraft === undefined
			? (invoice.seller_details ?? resolvedSeller)
			: (sellerDraft ?? resolvedSeller);

	const isBillingCustom =
		billingDraft === undefined
			? canResolveBilling && invoice.billing_details !== null
			: billingDraft !== null;
	const isSellerCustom =
		sellerDraft === undefined
			? invoice.seller_details !== null
			: sellerDraft !== null;

	const canEditParties = isDraft && !invoice.is_reversal;

	const draftFor = (line: InvoiceLineModel): LineDraft =>
		drafts[line.id] ?? toDraft(line);

	/*
	 * A line raised from an order line or a shipping row cannot bill more of it, nor bill it
	 * dearer, than that row carries; the API refuses the same with a 409, checked here so the
	 * operator sees it before saving.
	 */
	const capsFor = (line: InvoiceLineModel) => {
		const draft = draftFor(line);

		return {
			isQuantityOver:
				line.max_quantity != null &&
				Number(draft.quantity) > line.max_quantity,
			isPriceOver:
				line.max_unit_price != null &&
				Number(draft.unit_price) > line.max_unit_price,
		};
	};

	const keptLines = lines.filter((line) => !removedIds.has(line.id));

	// The add row counts once something is typed into it, so a Save does not drop it silently
	const isNewLineStarted = newLine.label.trim() !== '';

	const isDirty =
		details !== null ||
		billingDraft !== undefined ||
		sellerDraft !== undefined ||
		Object.keys(drafts).length > 0 ||
		removedIds.size > 0 ||
		added.length > 0 ||
		isNewLineStarted;

	const isBlocked =
		keptLines.some((line) => {
			const caps = capsFor(line);

			return (
				caps.isQuantityOver ||
				caps.isPriceOver ||
				isIncomplete(draftFor(line))
			);
		}) ||
		added.some((item) => isIncomplete(item.draft)) ||
		(!!billingDraft && isPartyIncomplete(billingDraft)) ||
		(!!sellerDraft && isPartyIncomplete(sellerDraft)) ||
		(isNewLineStarted && isIncomplete(newLine));

	const setDetailsValue = (field: keyof DetailsDraft, value: string) => {
		setDetails({
			...currentDetails,
			[field]: value === '' ? null : value,
		});
	};

	const setDraftValue = (
		line: InvoiceLineModel,
		field: keyof LineDraft,
		value: string,
	) => {
		setDrafts((previous) => ({
			...previous,
			[line.id]: { ...draftFor(line), [field]: value },
		}));
	};

	const toggleRemoved = (lineId: number) => {
		setRemovedIds((previous) => {
			const next = new Set(previous);

			if (!next.delete(lineId)) {
				next.add(lineId);
			}

			return next;
		});
	};

	const addPendingLine = () => {
		setAdded((previous) => [
			...previous,
			{
				key: (previous.at(-1)?.key ?? 0) + 1,
				draft: newLine,
			},
		]);
		setNewLine(EMPTY_LINE);
	};

	const setAddedValue = (
		key: number,
		field: keyof LineDraft,
		value: string,
	) => {
		setAdded((previous) =>
			previous.map((item) =>
				item.key === key
					? { ...item, draft: { ...item.draft, [field]: value } }
					: item,
			),
		);
	};

	const save = async () => {
		setIsSaving(true);

		const params: InvoiceSaveParams = {
			...currentDetails,
			lines: [
				...keptLines.map((line) =>
					toLineParams(draftFor(line), line.id),
				),
				...added.map((item) => toLineParams(item.draft)),
				...(isNewLineStarted ? [toLineParams(newLine)] : []),
			],
			...(billingDraft === undefined
				? {}
				: { billing_details: billingDraft }),
			...(sellerDraft === undefined
				? {}
				: { seller_details: sellerDraft }),
		};

		try {
			const response = await requestUpdate<
				InvoiceModel,
				InvoiceSaveParams
			>('invoice', params, invoice.id);

			if (response && !response.success) {
				throw new Error(describeRefusal(response));
			}

			showToast({
				severity: 'success',
				summary: translations['app.success.title'],
				detail: translations['invoice.text.updated'],
			});

			setDetails(null);
			setDrafts({});
			setRemovedIds(new Set());
			setAdded([]);
			setNewLine(EMPTY_LINE);
			setBillingDraft(undefined);
			setSellerDraft(undefined);

			await refetch();
			await queryClient.invalidateQueries({
				queryKey: ['dataTable', 'invoice'],
			});
		} catch (saveError) {
			showToast({
				severity: 'error',
				summary: translations['app.error.title'],
				detail:
					saveError instanceof ApiError && saveError.body
						? describeRefusal(saveError.body)
						: (saveError as Error).message,
			});
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div className="space-y-6">
			<div className="space-y-3">
				<FormComponentCalendar<DetailsDraft>
					labelText={translations['invoice.field.due_at']}
					id={elementIds.dueAt}
					fieldName="due_at"
					fieldValue={currentDetails.due_at ?? ''}
					placeholderText={
						translations['invoice.text.placeholder_due_at']
					}
					disabled={!isEditable}
					onSelect={(value) => setDetailsValue('due_at', value)}
				/>

				<FormComponentTextarea<DetailsDraft>
					labelText={translations['invoice.field.notes']}
					id={elementIds.notes}
					fieldName="notes"
					fieldValue={currentDetails.notes ?? ''}
					rows={3}
					disabled={!isEditable}
					onChange={(event) =>
						setDetailsValue('notes', event.target.value)
					}
				/>
			</div>

			{canEditParties && (
				<div className="space-y-2">
					<BillingDetailsFields
						party={shownBilling}
						isCustom={isBillingCustom}
						notice={
							shownBilling === null
								? translations[
										'invoice.text.no_billing_address'
									]
								: undefined
						}
						disabled={!isEditable}
						onChange={setBillingDraft}
						onReset={
							canResolveBilling && isBillingCustom
								? () => setBillingDraft(null)
								: undefined
						}
					/>

					<SellerDetailsFields
						party={shownSeller}
						isCustom={isSellerCustom}
						disabled={!isEditable}
						onChange={setSellerDraft}
						onReset={
							isSellerCustom
								? () => setSellerDraft(null)
								: undefined
						}
					/>
				</div>
			)}

			<div>
				<p className="mb-1 text-sm font-medium">
					{translations['invoice.text.lines']}
				</p>

				{!isDraft && (
					<p className="text-sm opacity-70 mb-3">
						{
							translations[
								'invoice.text.this_document_has_been_issued_so'
							]
						}
					</p>
				)}

				<div
					className={`${gridClass} border-b border-line pb-2 text-sm opacity-70`}
				>
					<div>{translations['invoice.field.label']}</div>
					<div>{translations['invoice.field.quantity']}</div>
					<div>{translations['invoice.text.unit_price']}</div>
					<div>{translations['invoice.text.vat']}</div>
					<div>
						{translations['invoice.field.discount_reduction']}
					</div>
					<div className="text-right">
						{translations['invoice.field.total_gross']}
					</div>
					{isDraft && <div />}
				</div>

				<div className="divide-y divide-line">
					{lines.length === 0 && added.length === 0 && (
						<p className="py-3 text-sm opacity-70">
							{
								translations[
									'invoice.text.this_document_itemizes_nothing_yet'
								]
							}
						</p>
					)}

					{lines.map((line) => {
						const draft = draftFor(line);
						const isRemoved = removedIds.has(line.id);
						const { isQuantityOver, isPriceOver } = capsFor(line);

						return (
							<div
								key={`line-${line.id}`}
								className={`${gridClass} py-3 ${isRemoved ? 'opacity-50' : ''}`}
							>
								<LineInputs
									translations={translations}
									draft={draft}
									describedAs={replaceVars(
										translations[
											'invoice.text.described_line'
										],
										{
											id: line.id,
										},
									)}
									disabled={!isEditable || isRemoved}
									figuresDisabled={
										!isEditable ||
										isRemoved ||
										invoice.is_reversal
									}
									isStruck={isRemoved}
									maxQuantity={line.max_quantity}
									maxUnitPrice={line.max_unit_price}
									isQuantityOver={
										!isRemoved && isQuantityOver
									}
									isPriceOver={!isRemoved && isPriceOver}
									onChange={(field, value) =>
										setDraftValue(line, field, value)
									}
								/>

								<LineTotal
									draft={draft}
									currency={invoice.currency}
								/>

								{isDraft && (
									<Button
										type="button"
										variant="ghost"
										hover={isRemoved ? 'default' : 'error'}
										className="h-9 w-9"
										disabled={isSaving}
										aria-label={replaceVars(
											isRemoved
												? translations[
														'invoice.text.label_keep_line'
													]
												: translations[
														'invoice.text.label_remove_line'
													],
											{ id: line.id },
										)}
										title={
											isRemoved
												? translations[
														'invoice.text.keep_line'
													]
												: translations[
														'invoice.text.remove_on_save'
													]
										}
										onClick={() => toggleRemoved(line.id)}
									>
										{isRemoved ? (
											<Icons.Action.Reopen className="h-4 w-4" />
										) : (
											<Icons.Action.Delete className="h-4 w-4" />
										)}
									</Button>
								)}

								{!isRemoved && isQuantityOver && (
									<p className="col-span-full text-sm text-danger">
										{replaceVars(
											translations[
												'invoice.text.quantity_over'
											],
											{
												max: line.max_quantity ?? '',
											},
										)}
									</p>
								)}

								{!isRemoved && isPriceOver && (
									<p className="col-span-full text-sm text-danger">
										{replaceVars(
											translations[
												'invoice.text.price_over'
											],
											{
												max: line.max_unit_price ?? '',
											},
										)}
									</p>
								)}
							</div>
						);
					})}

					{added.map((item) => (
						<div
							key={`added-${item.key}`}
							className={`${gridClass} py-3`}
						>
							<LineInputs
								translations={translations}
								draft={item.draft}
								describedAs={replaceVars(
									translations[
										'invoice.text.described_new_line'
									],
									{
										key: item.key,
									},
								)}
								disabled={!isEditable}
								onChange={(field, value) =>
									setAddedValue(item.key, field, value)
								}
							/>

							<LineTotal
								draft={item.draft}
								currency={invoice.currency}
							/>

							<Button
								type="button"
								variant="ghost"
								hover="error"
								className="h-9 w-9"
								disabled={isSaving}
								aria-label={replaceVars(
									translations[
										'invoice.text.label_discard_new_line'
									],
									{ key: item.key },
								)}
								title={
									translations[
										'invoice.text.discard_this_line'
									]
								}
								onClick={() =>
									setAdded((previous) =>
										previous.filter(
											(other) => other.key !== item.key,
										),
									)
								}
							>
								<Icons.Action.Delete className="h-4 w-4" />
							</Button>
						</div>
					))}

					{canAddLines && (
						<div className="py-3">
							<p className="mb-2 text-sm opacity-70">
								{isCustomInvoice
									? translations['invoice.text.add_line_hint']
									: translations[
											'invoice.text.add_adjustment_hint'
										]}
							</p>

							<div className={gridClass}>
								<LineInputs
									translations={translations}
									draft={newLine}
									describedAs={
										translations[
											'invoice.text.described_the_new_line'
										]
									}
									disabled={!isEditable}
									labelPlaceholder={
										isCustomInvoice
											? translations[
													'invoice.text.placeholder_custom_line'
												]
											: translations[
													'invoice.text.placeholder_adjustment_line'
												]
									}
									onChange={(field, value) =>
										setNewLine((previous) => ({
											...previous,
											[field]: value,
										}))
									}
								/>

								<LineTotal
									draft={newLine}
									currency={invoice.currency}
								/>

								<Button
									type="button"
									variant="ghost"
									hover="success"
									className="h-9 w-9"
									disabled={
										!isEditable || isIncomplete(newLine)
									}
									aria-label={
										translations[
											'invoice.text.label_add_another_line'
										]
									}
									title={
										translations[
											'invoice.text.add_another_line'
										]
									}
									onClick={addPendingLine}
								>
									<Icons.Action.Add className="h-4 w-4" />
								</Button>
							</div>
						</div>
					)}
				</div>
			</div>

			{isDraft && (
				<div className="flex justify-end border-t border-line pt-4">
					<Button
						variant="default"
						disabled={isSaving || !isDirty || isBlocked}
						onClick={save}
					>
						{translations['invoice.text.save']}
					</Button>
				</div>
			)}
		</div>
	);
}
