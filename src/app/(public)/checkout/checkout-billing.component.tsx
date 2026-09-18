/*
 * No `'use client'`: `checkout.component.tsx` is the boundary that mounts this, and a file carrying
 * the directive is treated as a client entry whose callback props Next's TS plugin rejects
 * (TS71007) - the same reason `comment-edit.component.tsx` goes without it.
 */
import type { JSX } from 'react';
import type {
	BillingEditor,
	BillingErrors,
	BillingValues,
	CheckoutTranslations,
} from '@/app/(public)/checkout/checkout.definition';
import { toClientType } from '@/app/(public)/checkout/checkout.definition';
import {
	FormComponentInput,
	FormComponentRadio,
} from '@/components/form/form-element.component';
import { Icons } from '@/components/icon.component';
import { badgeVariants } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Radio, RadioGroup } from '@/components/ui/radio-group';
import { cn } from '@/helpers/css.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import {
	type ClientModel,
	ClientTypeEnum,
	displayClientLabel,
} from '@/models/client.model';

type TextField = Exclude<keyof BillingValues, 'client_type'>;

/**
 * The billing half of checkout: pick one of the account's clients, or write one.
 *
 * Holds no state. The editor's values live in `CheckoutForm` because "Place order" also saves
 * them - a shopper whose first billing entry is still an open form should not have to press a
 * second button before the order can go.
 */
export function CheckoutBilling({
	clients,
	selectedClientId,
	editor,
	values,
	errors,
	showErrors,
	isMissingSelection,
	translations,
	disabled,
	onSelect,
	onChange,
	onCreate,
	onEdit,
	onCancel,
	onSave,
}: {
	readonly clients: readonly ClientModel[];
	readonly selectedClientId: number | null;
	readonly editor: BillingEditor | null;
	readonly values: BillingValues;
	readonly errors: BillingErrors;
	readonly showErrors: boolean;
	/** Checkout was attempted with neither an entry chosen nor the editor open. */
	readonly isMissingSelection: boolean;
	readonly translations: CheckoutTranslations;
	readonly disabled: boolean;
	readonly onSelect: (clientId: number) => void;
	readonly onChange: (field: keyof BillingValues, value: string) => void;
	readonly onCreate: () => void;
	readonly onEdit: (client: ClientModel) => void;
	readonly onCancel: () => void;
	readonly onSave: () => void;
}): JSX.Element {
	const elementIds = useElementIds([
		'client',
		'client_type',
		'person_name',
		'company_name',
		'company_cui',
		'company_reg_com',
		'contact_name',
		'contact_email',
		'contact_phone',
	] as const);

	const fieldError = (field: keyof BillingValues): string[] | undefined => {
		const key = errors[field];

		return showErrors && key ? [translations[key]] : undefined;
	};

	const input = (
		field: TextField,
		options: { required?: boolean; type?: 'text' | 'email' } = {},
	) => (
		<FormComponentInput<BillingValues>
			id={elementIds[field]}
			labelText={translations[`checkout.billing.${field}`]}
			fieldName={field}
			fieldType={options.type ?? 'text'}
			fieldValue={values[field]}
			isRequired={options.required ?? false}
			disabled={disabled}
			onChange={(event) => onChange(field, event.target.value)}
			error={fieldError(field)}
		/>
	);

	return (
		<div className="space-y-4">
			<p className="text-sm text-muted">
				{translations['checkout.billing.intro']}
			</p>

			{clients.length > 0 && (
				<>
					<span id={elementIds.client} className="sr-only">
						{translations['checkout.billing.choose']}
					</span>

					{/*
					 * `RadioGroup` directly rather than `FormComponentRadio`: each entry needs an
					 * edit button beside it, and that wrapper renders the options as a bare row.
					 * The button sits outside the `Radio`, whose content is a `<label>`.
					 */}
					<RadioGroup
						aria-labelledby={elementIds.client}
						value={
							editor?.mode === 'create' ||
							selectedClientId === null
								? null
								: String(selectedClientId)
						}
						onChange={(value) => onSelect(Number(value))}
						isDisabled={disabled}
					>
						{clients.map((client) => (
							<div
								key={client.id}
								className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
							>
								{/*
								 * `mt-0!`: HeroUI gives every radio in a vertical group `mt-4`, which
								 * here sits inside a padded row and leaves more space above the entry
								 * than below it. The row's own `py-3` does the spacing instead.
								 */}
								<Radio
									value={String(client.id)}
									className="mt-0!"
									contentClassName="font-normal"
								>
									<span>
										<span className="flex flex-wrap items-center gap-2">
											{/*
											 * A `<span>` styled as a badge rather than `Badge`, which renders a
											 * `<div>` - this sits inside the radio's `<label>`. Icon and word
											 * both, so the type does not rest on color alone.
											 */}
											{client.client_type ===
											ClientTypeEnum.COMPANY ? (
												<span
													className={cn(
														badgeVariants({
															variant:
																'softAccent',
															size: 'xs',
														}),
														'gap-1 py-0.5',
													)}
												>
													<Icons.City className="h-3.5 w-3.5" />
													{
														translations[
															'checkout.billing.company'
														]
													}
												</span>
											) : (
												<span
													className={cn(
														badgeVariants({
															variant:
																'softDefault',
															size: 'xs',
														}),
														'gap-1 py-0.5',
													)}
												>
													<Icons.User className="h-3.5 w-3.5" />
													{
														translations[
															'checkout.billing.person'
														]
													}
												</span>
											)}

											<span className="font-medium">
												{displayClientLabel(client)}
											</span>

											{client.client_type ===
											ClientTypeEnum.COMPANY ? (
												<span className="text-xs text-muted">
													{client.company_cui}
												</span>
											) : null}
										</span>

										<span className="mt-1 block text-xs text-muted">
											{[
												client.contact_email,
												client.contact_phone,
											]
												.filter(Boolean)
												.join(' · ')}
										</span>
									</span>
								</Radio>

								<Button
									type="button"
									variant="ghost"
									hover="info"
									size="sm"
									disabled={disabled}
									onClick={() => onEdit(client)}
									className="p-2"
								>
									{translations['checkout.billing.edit']}
								</Button>
							</div>
						))}
					</RadioGroup>
				</>
			)}

			{isMissingSelection && (
				<p className="text-sm font-medium text-danger">
					{translations['checkout.validation.billing']}
				</p>
			)}

			{editor ? (
				<div className="form-section gap-4 rounded-xl border border-border p-4">
					<FormComponentRadio<BillingValues>
						id={elementIds.client_type}
						labelText={translations['checkout.billing.client_type']}
						fieldName="client_type"
						fieldValue={values.client_type}
						disabled={disabled}
						options={[
							{
								value: ClientTypeEnum.PERSON,
								label: translations['checkout.billing.person'],
							},
							{
								value: ClientTypeEnum.COMPANY,
								label: translations['checkout.billing.company'],
							},
						]}
						onChange={(value) => {
							if (toClientType(value)) {
								onChange('client_type', value);
							}
						}}
					/>

					<div className="grid gap-4 sm:grid-cols-2">
						{values.client_type === ClientTypeEnum.PERSON ? (
							input('person_name', { required: true })
						) : (
							<>
								{input('company_name', { required: true })}
								{input('company_cui', { required: true })}
								{input('company_reg_com')}
								{input('contact_name')}
							</>
						)}

						{input('contact_email', {
							required: true,
							type: 'email',
						})}
						{input('contact_phone', { required: true })}
					</div>

					<div className="flex flex-wrap items-center gap-3">
						<Button
							type="button"
							disabled={disabled}
							onClick={onSave}
						>
							{translations['checkout.billing.save']}
						</Button>

						{/* Nothing to fall back to without an entry, so the form cannot be closed */}
						{clients.length > 0 && (
							<Button
								type="button"
								variant="ghost"
								disabled={disabled}
								onClick={onCancel}
							>
								{translations['checkout.billing.cancel']}
							</Button>
						)}
					</div>
				</div>
			) : (
				<Button
					type="button"
					variant="outline"
					hover="success"
					disabled={disabled}
					onClick={onCreate}
				>
					{translations['checkout.billing.add']}
				</Button>
			)}
		</div>
	);
}
