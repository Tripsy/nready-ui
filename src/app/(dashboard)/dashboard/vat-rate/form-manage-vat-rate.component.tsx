import { useMemo } from 'react';
import {
	FormComponentCalendar,
	FormComponentInput,
	FormComponentSelect,
	FormComponentTextarea,
} from '@/components/form/form-element.component';
import { toOptionsFromEnum } from '@/helpers/form.helper';
import {
	enumTranslationKeys,
	replaceVars,
	translateEnumLabel,
} from '@/helpers/string.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useTranslation } from '@/hooks/use-translation.hook';
import {
	COUNTRY_CODE_CHARS,
	VAT_RATE_MAX_DECIMALS,
	type VatRateCategory,
	VatRateCategoryEnum,
} from '@/models/vat-rate.model';
import { useWindowForm } from '@/providers/window-form.provider';

const TRANSLATION_KEYS = [
	'vat-rate.text.country_label',
	'vat-rate.text.placeholder_country',
	'vat-rate.field.category',
	'vat-rate.text.rate_label',
	'vat-rate.text.placeholder_rate',
	'vat-rate.field.valid_from',
	'vat-rate.field.notes',
	'app.form.placeholder_select',
	...enumTranslationKeys('vat-rate.enum.category', VatRateCategoryEnum),
] as const;

export type VatRateFormValuesType = {
	country_code: string | null;
	category: VatRateCategory | null;
	rate: number | null;
	valid_from: string | null;
	notes: string | null;
};

export function FormManageVatRate() {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const categories = useMemo(
		() =>
			toOptionsFromEnum(VatRateCategoryEnum, {
				formatter: (value) =>
					translateEnumLabel(
						translations,
						'vat-rate.enum.category',
						value,
					),
			}),
		[translations],
	);

	const { formOperation, formValues, errors, handleChange, pending } =
		useWindowForm<VatRateFormValuesType>();

	const elementIds = useElementIds([
		'countryCode',
		'category',
		'rate',
		'validFrom',
		'notes',
	] as const);

	/*
	 * The country, the class and the day together identify the row - the backend's update
	 * payload has no slot for any of them, so a rate entered for the wrong one is deleted and
	 * entered again. They stay visible on update for context but disabled, which also keeps them
	 * out of the submitted `FormData`.
	 */
	const isIdentityEditable = formOperation === 'create';

	return (
		<>
			<FormComponentInput<VatRateFormValuesType>
				labelText={replaceVars(
					translations['vat-rate.text.country_label'],
					{
						chars: COUNTRY_CODE_CHARS,
					},
				)}
				id={elementIds.countryCode}
				fieldName="country_code"
				fieldValue={formValues.country_code ?? ''}
				isRequired={true}
				placeholderText={
					translations['vat-rate.text.placeholder_country']
				}
				disabled={pending || !isIdentityEditable}
				// Uppercased on the way in so the field shows what will be stored: the unique
				// index would not see `ro` and `RO` as one country
				onChange={(e) =>
					handleChange('country_code', e.target.value.toUpperCase())
				}
				error={errors.country_code}
			/>

			<FormComponentSelect<VatRateFormValuesType>
				labelText={translations['vat-rate.field.category']}
				id={elementIds.category}
				fieldName="category"
				fieldValue={formValues.category}
				options={categories}
				isRequired={true}
				disabled={pending || !isIdentityEditable}
				onChange={(value) =>
					handleChange('category', value as VatRateCategory)
				}
				error={errors.category}
			/>

			{/* Any day: a future one is how a published change is entered ahead of time */}
			<FormComponentCalendar<VatRateFormValuesType>
				labelText={translations['vat-rate.field.valid_from']}
				id={elementIds.validFrom}
				fieldName="valid_from"
				fieldValue={formValues.valid_from ?? ''}
				isRequired={true}
				placeholderText={translations['app.form.placeholder_select']}
				disabled={pending || !isIdentityEditable}
				onSelect={(value) =>
					handleChange('valid_from', value === '' ? null : value)
				}
				error={errors.valid_from}
			/>

			<FormComponentInput<VatRateFormValuesType>
				labelText={replaceVars(
					translations['vat-rate.text.rate_label'],
					{
						decimals: VAT_RATE_MAX_DECIMALS,
					},
				)}
				id={elementIds.rate}
				fieldName="rate"
				fieldType="number"
				fieldValue={formValues.rate ?? null}
				isRequired={true}
				placeholderText={translations['vat-rate.text.placeholder_rate']}
				disabled={pending}
				onChange={(e) =>
					handleChange(
						'rate',
						e.target.value === '' ? null : Number(e.target.value),
					)
				}
				error={errors.rate}
			/>

			<FormComponentTextarea<VatRateFormValuesType>
				labelText={translations['vat-rate.field.notes']}
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
