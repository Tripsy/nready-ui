'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
	ErrorComponent,
	LoadingComponent,
} from '@/components/status.component';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DisplayAmount } from '@/helpers/display.helper';
import type { ValidationIssueType } from '@/helpers/form.helper';
import { requestView } from '@/helpers/services.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import {
	type InvoiceLineModel,
	type InvoiceModel,
	InvoiceStatusEnum,
} from '@/models/invoice.model';
import { useToast } from '@/providers/toast.provider';
import {
	requestInvoiceLineCreate,
	requestInvoiceLineDelete,
	requestInvoiceLineUpdate,
} from '@/services/invoice.service';

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
 * messages are read defensively and joined onto the toast.
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

/** What the add-line row starts from; a quantity of one is what most corrections carry. */
const EMPTY_LINE: LineDraft = {
	label: '',
	quantity: '1',
	unit_price: '',
	vat_rate: '0',
	discount_reduction: '0',
};

function toDraft(line: InvoiceLineModel): LineDraft {
	return {
		label: line.label,
		quantity: String(line.quantity),
		unit_price: String(line.unit_price),
		vat_rate: String(line.vat_rate),
		discount_reduction: String(line.discount_reduction),
	};
}

/**
 * The lines of a draft, where one is added, restated or dropped.
 *
 * Read through `read` rather than from the row the table hands over: the listing carries no lines.
 * Every write re-reads the document, because the API re-sums the totals behind each one - showing
 * the figures this window was opened with would let an operator work from numbers that have
 * already moved.
 *
 * Drafts only, so nothing here has to answer for an issued document: the action that opens it is
 * gated the same way, and the API refuses a line write once the document has left `draft`.
 */
export function ManageInvoice({ entries }: { entries: InvoiceModel[] }) {
	const entry = entries[0];

	const queryClient = useQueryClient();
	const { showToast } = useToast();

	const [drafts, setDrafts] = useState<Record<number, LineDraft>>({});
	const [pendingId, setPendingId] = useState<number | null>(null);
	const [newLine, setNewLine] = useState<LineDraft>(EMPTY_LINE);
	const [isAdding, setIsAdding] = useState(false);

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

	/** Re-reads the document and the listing behind it, whose totals have moved with it. */
	const refresh = async () => {
		setDrafts({});

		await refetch();
		await queryClient.invalidateQueries({
			queryKey: ['dataTable', 'invoice'],
		});
	};

	const runWrite = async (
		lineOrPaymentId: number,
		write: () => Promise<{ message: string; success: boolean } | undefined>,
		successDetail: string,
	) => {
		setPendingId(lineOrPaymentId);

		try {
			const response = await write();

			// The envelope reports a refusal in `success`; a 4xx never rejects here
			if (response && !response.success) {
				throw new Error(describeRefusal(response));
			}

			showToast({
				severity: 'success',
				summary: 'Success',
				detail: successDetail,
			});

			await refresh();
		} catch (writeError) {
			showToast({
				severity: 'error',
				summary: 'Error',
				detail: (writeError as Error).message,
			});
		} finally {
			setPendingId(null);
		}
	};

	const draftFor = (line: InvoiceLineModel): LineDraft =>
		drafts[line.id] ?? toDraft(line);

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

	const saveLine = (line: InvoiceLineModel) => {
		const draft = draftFor(line);

		return runWrite(
			line.id,
			() =>
				requestInvoiceLineUpdate(invoice.id, line.id, {
					label: draft.label,
					quantity: Number(draft.quantity),
					unit_price: Number(draft.unit_price),
					vat_rate: Number(draft.vat_rate),
					discount_reduction: Number(draft.discount_reduction),
				}),
			'Invoice line updated successfully',
		);
	};

	const addLine = async () => {
		setIsAdding(true);

		try {
			const response = await requestInvoiceLineCreate(invoice.id, {
				label: newLine.label,
				quantity: Number(newLine.quantity),
				unit_price: Number(newLine.unit_price),
				vat_rate: Number(newLine.vat_rate),
				discount_reduction: Number(newLine.discount_reduction),
			});

			if (response && !response.success) {
				throw new Error(describeRefusal(response));
			}

			showToast({
				severity: 'success',
				summary: 'Success',
				detail: 'Invoice line added successfully',
			});

			setNewLine(EMPTY_LINE);

			await refresh();
		} catch (addError) {
			showToast({
				severity: 'error',
				summary: 'Error',
				detail: (addError as Error).message,
			});
		} finally {
			setIsAdding(false);
		}
	};

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-center gap-4 border-b border-line pb-4">
				<span className="font-semibold">Total</span>
				<DisplayAmount
					amount={invoice.total_gross}
					currencyCode={invoice.currency}
				/>
				<span className="font-semibold">VAT</span>
				<DisplayAmount
					amount={invoice.total_vat}
					currencyCode={invoice.currency}
				/>
			</div>

			<div>
				<h3 className="font-bold border-b border-line pb-2 mb-3">
					Lines
				</h3>

				{!isDraft && (
					<p className="text-sm opacity-70 mb-3">
						This document has been issued, so its lines are the
						record of what was charged and can no longer be changed.
					</p>
				)}

				{lines.length === 0 && (
					<p className="text-sm opacity-70">
						This document itemizes nothing yet.
					</p>
				)}

				<div className="space-y-3">
					{lines.map((line) => {
						const draft = draftFor(line);
						const isPending = pendingId === line.id;

						return (
							<div
								key={`line-${line.id}`}
								className="flex flex-wrap items-end gap-2 border-t border-line pt-3"
							>
								<div className="w-24 text-sm opacity-70">
									{formatEnumLabel(line.kind)}
								</div>

								<Input
									aria-label={`Label of line ${line.id}`}
									className="flex-1 min-w-48"
									value={draft.label}
									disabled={!isDraft || isPending}
									onChange={(event) =>
										setDraftValue(
											line,
											'label',
											event.target.value,
										)
									}
								/>

								<Input
									aria-label={`Quantity of line ${line.id}`}
									className="w-20"
									type="number"
									value={draft.quantity}
									disabled={!isDraft || isPending}
									onChange={(event) =>
										setDraftValue(
											line,
											'quantity',
											event.target.value,
										)
									}
								/>

								<Input
									aria-label={`Unit price of line ${line.id}`}
									className="w-28"
									type="number"
									value={draft.unit_price}
									disabled={!isDraft || isPending}
									onChange={(event) =>
										setDraftValue(
											line,
											'unit_price',
											event.target.value,
										)
									}
								/>

								<Input
									aria-label={`VAT rate of line ${line.id}`}
									className="w-20"
									type="number"
									value={draft.vat_rate}
									disabled={!isDraft || isPending}
									onChange={(event) =>
										setDraftValue(
											line,
											'vat_rate',
											event.target.value,
										)
									}
								/>

								<Input
									aria-label={`Discount of line ${line.id}`}
									className="w-24"
									type="number"
									value={draft.discount_reduction}
									disabled={!isDraft || isPending}
									onChange={(event) =>
										setDraftValue(
											line,
											'discount_reduction',
											event.target.value,
										)
									}
								/>

								<div className="w-28 text-right">
									<DisplayAmount
										amount={line.line_total}
										currencyCode={invoice.currency}
									/>
								</div>

								{isDraft && (
									<>
										<Button
											variant="outline"
											hover="success"
											disabled={isPending}
											onClick={() => saveLine(line)}
										>
											Save
										</Button>

										<Button
											variant="outline"
											hover="error"
											disabled={isPending}
											onClick={() =>
												runWrite(
													line.id,
													() =>
														requestInvoiceLineDelete(
															invoice.id,
															line.id,
														),
													'Invoice line removed successfully',
												)
											}
										>
											Remove
										</Button>
									</>
								)}
							</div>
						);
					})}
				</div>
			</div>

			{isDraft && (
				<div>
					<h3 className="font-bold border-b border-line pb-2 mb-3">
						Add an adjustment line
					</h3>

					<p className="text-sm opacity-70 mb-3">
						Rounding, a manual correction, anything with no source
						row behind it. A product or shipping line names the row
						it was raised from and comes from the order.
					</p>

					<div className="flex flex-wrap items-end gap-2">
						<Input
							aria-label="Label of the new line"
							className="flex-1 min-w-48"
							placeholder="e.g.: Rounding adjustment"
							value={newLine.label}
							disabled={isAdding}
							onChange={(event) =>
								setNewLine((previous) => ({
									...previous,
									label: event.target.value,
								}))
							}
						/>

						<Input
							aria-label="Quantity of the new line"
							className="w-20"
							type="number"
							value={newLine.quantity}
							disabled={isAdding}
							onChange={(event) =>
								setNewLine((previous) => ({
									...previous,
									quantity: event.target.value,
								}))
							}
						/>

						<Input
							aria-label="Unit price of the new line"
							className="w-28"
							type="number"
							placeholder="unit price"
							value={newLine.unit_price}
							disabled={isAdding}
							onChange={(event) =>
								setNewLine((previous) => ({
									...previous,
									unit_price: event.target.value,
								}))
							}
						/>

						<Input
							aria-label="VAT rate of the new line"
							className="w-20"
							type="number"
							value={newLine.vat_rate}
							disabled={isAdding}
							onChange={(event) =>
								setNewLine((previous) => ({
									...previous,
									vat_rate: event.target.value,
								}))
							}
						/>

						<Input
							aria-label="Discount of the new line"
							className="w-24"
							type="number"
							value={newLine.discount_reduction}
							disabled={isAdding}
							onChange={(event) =>
								setNewLine((previous) => ({
									...previous,
									discount_reduction: event.target.value,
								}))
							}
						/>

						<Button
							variant="default"
							disabled={
								isAdding ||
								newLine.label.trim() === '' ||
								newLine.unit_price.trim() === ''
							}
							onClick={addLine}
						>
							Add
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
