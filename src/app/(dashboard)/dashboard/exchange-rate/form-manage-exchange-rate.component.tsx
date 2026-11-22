'use client';

import {
	FormComponentCalendar,
	FormComponentInput,
	FormComponentTextarea,
} from '@/components/form/form-element.component';
import { createCurrentDate } from '@/helpers/date.helper';
import { replaceVars } from '@/helpers/string.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useTranslation } from '@/hooks/use-translation.hook';
import {
	CURRENCY_CODE_CHARS,
	EXCHANGE_RATE_MAX_DECIMALS,
} from '@/models/exchange-rate.model';
import { useWindowForm } from '@/providers/window-form.provider';

const TRANSLATION_KEYS = [
	'exchange-rate.text.label_currency',
	'exchange-rate.field.notes',
	'exchange-rate.text.label_rate',
	'exchange-rate.field.rate_date',
	'exchange-rate.text.placeholder_currency',
	'exchange-rate.text.placeholder_rate',
	'exchange-rate.text.placeholder_rate_date',
] as const;

export type ExchangeRateFormValuesType = {
	currency: string | null;
	rate: number | null;
	rate_date: string | null;
	notes: string | null;
};

export function FormManageExchangeRate() {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const { formOperation, formValues, errors, handleChange, pending } =
		useWindowForm<ExchangeRateFormValuesType>();

	const elementIds = useElementIds([
		'currency',
		'rate',
		'rateDate',
		'notes',
	] as const);

	/*
	 * The currency and the day it applies to are together the row's identity - the backend's
	 * update payload has no slot for either, and moving one would rewrite a rate documents were
	 * already priced against. Both stay visible on update for context but disabled, which also
	 * keeps their inputs out of the submitted `FormData`.
	 */
	const isIdentityEditable = formOperation === 'create';

	// A rate is published for a day that has begun, never announced ahead
	const today = createCurrentDate(true);

	return (
		<>
			<FormComponentInput<ExchangeRateFormValuesType>
				labelText={replaceVars(
					translations['exchange-rate.text.label_currency'],
					{ chars: CURRENCY_CODE_CHARS },
				)}
				id={elementIds.currency}
				fieldName="currency"
				fieldValue={formValues.currency ?? ''}
				isRequired={true}
				placeholderText={
					translations['exchange-rate.text.placeholder_currency']
				}
				disabled={pending || !isIdentityEditable}
				// Uppercased on the way in so the field shows what will be stored: the column is
				// `char(3)` and Postgres does not fold case, so `eur` would sit unmatched beside
				// its uppercase twin
				onChange={(e) =>
					handleChange('currency', e.target.value.toUpperCase())
				}
				error={errors.currency}
			/>

			<FormComponentCalendar<ExchangeRateFormValuesType>
				labelText={translations['exchange-rate.field.rate_date']}
				id={elementIds.rateDate}
				fieldName="rate_date"
				fieldValue={formValues.rate_date ?? ''}
				isRequired={true}
				placeholderText={
					translations['exchange-rate.text.placeholder_rate_date']
				}
				maxDate={today}
				disabled={pending || !isIdentityEditable}
				onSelect={(value) =>
					handleChange('rate_date', value === '' ? null : value)
				}
				error={errors.rate_date}
			/>

			<FormComponentInput<ExchangeRateFormValuesType>
				labelText={replaceVars(
					translations['exchange-rate.text.label_rate'],
					{ max: EXCHANGE_RATE_MAX_DECIMALS },
				)}
				id={elementIds.rate}
				fieldName="rate"
				fieldType="number"
				fieldValue={formValues.rate ?? null}
				isRequired={true}
				placeholderText={
					translations['exchange-rate.text.placeholder_rate']
				}
				disabled={pending}
				onChange={(e) =>
					handleChange(
						'rate',
						e.target.value === '' ? null : Number(e.target.value),
					)
				}
				error={errors.rate}
			/>

			<FormComponentTextarea<ExchangeRateFormValuesType>
				labelText={translations['exchange-rate.field.notes']}
				id={elementIds.notes}
				fieldName="notes"
				fieldValue={formValues.notes ?? ''}
				rows={3}
				disabled={pending}
				onChange={(e) => handleChange('notes', e.target.value)}
				error={errors.notes}
			/>
		</>
	);
}
