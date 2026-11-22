'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import { FormTargetsDiscount } from '@/app/(dashboard)/dashboard/discount/form-targets-discount.component';
import {
	FormComponentCalendar,
	FormComponentInput,
	FormComponentSelect,
	FormComponentTextarea,
} from '@/components/form/form-element.component';
import { ISO_WEEKDAY_KEYS, ISO_WEEKDAYS } from '@/helpers/date.helper';
import { toOptionsFromEnum } from '@/helpers/form.helper';
import {
	enumTranslationKeys,
	translateEnumLabel,
} from '@/helpers/string.helper';
import { resolveWindowEntries } from '@/helpers/window.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useTranslation } from '@/hooks/use-translation.hook';
import {
	type DiscountReason,
	DiscountReasonEnum,
	type DiscountScope,
	DiscountScopeEnum,
	type DiscountType,
	DiscountTypeEnum,
	getDiscountTargetScope,
} from '@/models/discount.model';
import { useWindowForm } from '@/providers/window-form.provider';
import { requestDiscountTargets } from '@/services/discount.service';
import { useModalStore } from '@/stores/window.store';
import type { EntityId } from '@/types/entity-id.type';

const TRANSLATION_KEYS = [
	'discount.field.condition_countries',
	'discount.field.condition_day_from',
	'discount.field.condition_day_to',
	'discount.field.condition_hour_from',
	'discount.field.condition_hour_to',
	'discount.field.condition_min_order_value',
	'discount.field.end_at',
	'discount.field.label',
	'discount.field.notes',
	'discount.field.reason',
	'discount.field.reference',
	'discount.field.scope',
	'discount.field.start_at',
	'discount.field.type',
	'discount.text.all_must_be_met_for_the',
	'discount.text.conditions',
	'discount.text.placeholder_condition_countries',
	'discount.text.placeholder_condition_min_order_value',
	'discount.text.placeholder_end_at',
	'discount.text.placeholder_label',
	'discount.text.placeholder_reference',
	'discount.text.placeholder_start_at',
	'discount.text.reduces_the_delivery_or_return_price',
	'discount.text.label_value_percent',
	'discount.field.value',
	...enumTranslationKeys('discount.enum.scope', DiscountScopeEnum),
	...enumTranslationKeys('discount.enum.reason', DiscountReasonEnum),
	...enumTranslationKeys('discount.enum.type', DiscountTypeEnum),
	...ISO_WEEKDAY_KEYS,
] as const;

export type DiscountFormValuesType = {
	label: string | null;
	scope: DiscountScope;
	reason: DiscountReason;
	reference: string | null;
	type: DiscountType;
	value: number | null;
	/*
	 * Conditions are edited as separate fields, not as JSON, and kept flat because
	 * `FormValuesType` admits scalars and arrays-of-records but not a nested object of mixed
	 * shapes. `prepareParamsFromFormValues` assembles the `conditions` object on the way out
	 * and `getFormState` takes it apart on the way in - those two are a pair, change them
	 * together.
	 *
	 * A range needs both ends or neither; the validator enforces that rather than guessing a
	 * missing bound.
	 */
	condition_min_order_value: number | null;
	condition_countries: string | null;
	condition_hour_from: number | null;
	condition_hour_to: number | null;
	condition_day_from: number | null;
	condition_day_to: number | null;
	start_at: string | null;
	end_at: string | null;
	notes: string | null;
	/**
	 * Owner ids for the selected scope, submitted to `PUT /discounts/:id/targets` rather than
	 * in the discount payload.
	 *
	 * Wrapped as `{ id }` records because `FormValuesType` admits arrays of records but not a
	 * bare `number[]` - the picker itself works in plain ids and converts at this boundary.
	 */
	targets: { id: EntityId }[];
};

export function FormManageDiscount() {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const weekdayOptions = useMemo(
		() =>
			// The select's values are strings; the shared list is the numbering the backend stores
			ISO_WEEKDAYS.map((day) => ({
				label: translations[day.labelKey],
				value: String(day.value),
			})),
		[translations],
	);

	const types = useMemo(
		() =>
			toOptionsFromEnum(DiscountTypeEnum, {
				formatter: (value) =>
					translateEnumLabel(
						translations,
						'discount.enum.type',
						value,
					),
			}),
		[translations],
	);

	const reasons = useMemo(
		() =>
			toOptionsFromEnum(DiscountReasonEnum, {
				formatter: (value) =>
					translateEnumLabel(
						translations,
						'discount.enum.reason',
						value,
					),
			}),
		[translations],
	);

	const scopes = useMemo(
		() =>
			toOptionsFromEnum(DiscountScopeEnum, {
				formatter: (value) =>
					translateEnumLabel(
						translations,
						'discount.enum.scope',
						value,
					),
			}),
		[translations],
	);

	const { formValues, errors, handleChange, pending } =
		useWindowForm<DiscountFormValuesType>();

	// The backend rejects a start/end date in the past, so the pickers cannot offer one.
	// Bounding the input beats validating it: an already-started discount keeps its stored
	// date on the update form, which a past-date rule would flag on an untouched field.
	const today = new Date();

	const targetScope = getDiscountTargetScope(formValues.scope);

	/*
	 * `FormErrorsType` types an array field's errors per item, but the "pick at least one"
	 * issue is raised on the array itself, and `accumulateZodErrors` stores that as a plain
	 * message list under the key. The cast reflects what is actually there at runtime.
	 */
	const targetsError = errors.targets as string[] | undefined;

	const { getCurrentWindow } = useModalStore();
	const windowConfig = getCurrentWindow();
	const { entry } = windowConfig
		? resolveWindowEntries(windowConfig, 'form')
		: {};

	const entryId = entry && 'id' in entry ? (entry.id as EntityId) : undefined;

	/*
	 * Targets live behind their own endpoint, so `getFormState` - which only sees the discount
	 * row - cannot seed them. They are fetched here instead, the same way cash-flow loads its
	 * operational records.
	 */
	const { data: storedTargets, isLoading: targetsLoading } = useQuery({
		queryKey: ['discount', 'targets', entryId],
		// biome-ignore lint/style/noNonNullAssertion: gated by `enabled`
		queryFn: () => requestDiscountTargets(entryId!),
		enabled: !!entryId,
		/*
		 * Overrides the provider's 5-minute `staleTime`: this data is written by the manage
		 * form through a different endpoint, so a cached copy is wrong the moment a submit
		 * succeeds. It is a handful of ids - refetching per mount is cheaper than reasoning
		 * about who has to invalidate it.
		 */
		staleTime: 0,
		refetchOnMount: 'always',
	});

	/*
	 * Seeds the picker once the fetch lands. Guarded by a ref rather than keyed on the data,
	 * because writing to form state on every render of a settled query would overwrite whatever
	 * the user has since added or removed.
	 */
	const seeded = useRef(false);

	useEffect(() => {
		if (seeded.current || !storedTargets) {
			return;
		}

		seeded.current = true;

		if (!targetScope) {
			return;
		}

		const ids = storedTargets[targetScope] ?? [];

		if (ids.length > 0) {
			// Ids are all the endpoint returns; labels fill in as the user re-searches.
			handleChange(
				'targets',
				ids.map((id) => ({ id })),
			);
		}
	}, [storedTargets, handleChange, targetScope]);

	const elementIds = useElementIds([
		'label',
		'scope',
		'reason',
		'reference',
		'type',
		'value',
		'conditionMinOrderValue',
		'conditionCountries',
		'conditionHourFrom',
		'conditionHourTo',
		'conditionDayFrom',
		'conditionDayTo',
		'startAt',
		'endAt',
		'notes',
	] as const);

	return (
		<>
			<FormComponentInput<DiscountFormValuesType>
				labelText={translations['discount.field.label']}
				id={elementIds.label}
				fieldName="label"
				fieldValue={formValues.label ?? ''}
				isRequired={true}
				placeholderText={
					translations['discount.text.placeholder_label']
				}
				disabled={pending}
				onChange={(e) => handleChange('label', e.target.value)}
				error={errors.label}
			/>

			<FormComponentInput<DiscountFormValuesType>
				labelText={translations['discount.field.reference']}
				id={elementIds.reference}
				fieldName="reference"
				fieldValue={formValues.reference ?? ''}
				isRequired={true}
				placeholderText={
					translations['discount.text.placeholder_reference']
				}
				disabled={pending}
				onChange={(e) => handleChange('reference', e.target.value)}
				error={errors.reference}
			/>

			<div className="flex flex-wrap gap-2">
				<FormComponentSelect<DiscountFormValuesType>
					labelText={translations['discount.field.scope']}
					className="w-28"
					id={elementIds.scope}
					fieldName="scope"
					fieldValue={formValues.scope}
					isRequired={true}
					options={scopes}
					disabled={pending}
					onChange={(value) => {
						handleChange('scope', value as DiscountScope);
						// Targets belong to the scope they were picked under; a category id
						// is meaningless once the scope becomes `brand`.
						handleChange('targets', []);
					}}
					error={errors.scope}
				/>

				<FormComponentSelect<DiscountFormValuesType>
					labelText={translations['discount.field.reason']}
					className="w-48"
					id={elementIds.reason}
					fieldName="reason"
					fieldValue={formValues.reason}
					isRequired={true}
					options={reasons}
					disabled={pending}
					onChange={(value) =>
						handleChange('reason', value as DiscountReason)
					}
					error={errors.reason}
				/>
			</div>

			{/*
			 * Directly under Scope, which is what decides the target type: the picker searches
			 * clients, categories, brands, products or variants depending on it, and changing
			 * Scope clears whatever was picked under the previous one.
			 */}
			{targetScope && (
				<div className="space-y-2">
					<FormTargetsDiscount
						scope={targetScope}
						value={(formValues.targets ?? []).map(
							(target) => target.id,
						)}
						onChange={(ids) =>
							handleChange(
								'targets',
								ids.map((id) => ({ id })),
							)
						}
						disabled={pending}
						isLoading={targetsLoading}
						error={targetsError}
					/>
					{formValues.scope === DiscountScopeEnum.SHIPPING && (
						<p className="text-xs text-muted">
							{
								translations[
									'discount.text.reduces_the_delivery_or_return_price'
								]
							}
						</p>
					)}
				</div>
			)}

			<div className="flex flex-wrap gap-2">
				<FormComponentSelect<DiscountFormValuesType>
					labelText={translations['discount.field.type']}
					className="w-24"
					id={elementIds.type}
					fieldName="type"
					fieldValue={formValues.type}
					isRequired={true}
					options={types}
					disabled={pending}
					onChange={(value) =>
						handleChange('type', value as DiscountType)
					}
					error={errors.type}
				/>

				<FormComponentInput<DiscountFormValuesType>
					labelText={
						formValues.type === DiscountTypeEnum.PERCENT
							? translations['discount.text.label_value_percent']
							: translations['discount.field.value']
					}
					id={elementIds.value}
					fieldName="value"
					fieldType="number"
					fieldValue={formValues.value ?? null}
					isRequired={true}
					disabled={pending}
					onChange={(e) =>
						handleChange(
							'value',
							e.target.value === ''
								? null
								: Number(e.target.value),
						)
					}
					error={errors.value}
				/>
			</div>

			<div className="flex flex-wrap gap-2">
				<FormComponentCalendar<DiscountFormValuesType>
					labelText={translations['discount.field.start_at']}
					id={elementIds.startAt}
					fieldName="start_at"
					fieldValue={formValues.start_at ?? ''}
					placeholderText={
						translations['discount.text.placeholder_start_at']
					}
					minDate={today}
					disabled={pending}
					onSelect={(value) =>
						handleChange('start_at', value === '' ? null : value)
					}
					error={errors.start_at}
				/>

				<FormComponentCalendar<DiscountFormValuesType>
					labelText={translations['discount.field.end_at']}
					id={elementIds.endAt}
					fieldName="end_at"
					fieldValue={formValues.end_at ?? ''}
					placeholderText={
						translations['discount.text.placeholder_end_at']
					}
					minDate={today}
					disabled={pending}
					onSelect={(value) =>
						handleChange('end_at', value === '' ? null : value)
					}
					error={errors.end_at}
				/>
			</div>

			<div className="space-y-2">
				<span className="text-sm font-medium">
					{translations['discount.text.conditions']}
				</span>
				<p className="text-xs text-muted">
					{translations['discount.text.all_must_be_met_for_the']}
				</p>

				<div className="flex flex-wrap gap-2">
					<FormComponentInput<DiscountFormValuesType>
						labelText={
							translations[
								'discount.field.condition_min_order_value'
							]
						}
						id={elementIds.conditionMinOrderValue}
						fieldName="condition_min_order_value"
						fieldType="number"
						fieldValue={
							formValues.condition_min_order_value ?? null
						}
						placeholderText={
							translations[
								'discount.text.placeholder_condition_min_order_value'
							]
						}
						disabled={pending}
						onChange={(e) =>
							handleChange(
								'condition_min_order_value',
								e.target.value === ''
									? null
									: Number(e.target.value),
							)
						}
						error={errors.condition_min_order_value}
					/>

					<FormComponentInput<DiscountFormValuesType>
						labelText={
							translations['discount.field.condition_countries']
						}
						id={elementIds.conditionCountries}
						fieldName="condition_countries"
						fieldValue={formValues.condition_countries ?? ''}
						placeholderText={
							translations[
								'discount.text.placeholder_condition_countries'
							]
						}
						disabled={pending}
						onChange={(e) =>
							handleChange('condition_countries', e.target.value)
						}
						error={errors.condition_countries}
					/>
				</div>

				<div className="flex flex-wrap gap-2">
					<FormComponentInput<DiscountFormValuesType>
						labelText={
							translations['discount.field.condition_hour_from']
						}
						id={elementIds.conditionHourFrom}
						fieldName="condition_hour_from"
						fieldType="number"
						fieldValue={formValues.condition_hour_from ?? null}
						placeholderText="0-23"
						disabled={pending}
						onChange={(e) =>
							handleChange(
								'condition_hour_from',
								e.target.value === ''
									? null
									: Number(e.target.value),
							)
						}
						error={errors.condition_hour_from}
					/>

					<FormComponentInput<DiscountFormValuesType>
						labelText={
							translations['discount.field.condition_hour_to']
						}
						id={elementIds.conditionHourTo}
						fieldName="condition_hour_to"
						fieldType="number"
						fieldValue={formValues.condition_hour_to ?? null}
						placeholderText="0-23"
						disabled={pending}
						onChange={(e) =>
							handleChange(
								'condition_hour_to',
								e.target.value === ''
									? null
									: Number(e.target.value),
							)
						}
						error={errors.condition_hour_to}
					/>
				</div>

				<div className="flex flex-wrap gap-2">
					<FormComponentSelect<DiscountFormValuesType>
						labelText={
							translations['discount.field.condition_day_from']
						}
						className="w-32"
						id={elementIds.conditionDayFrom}
						fieldName="condition_day_from"
						fieldValue={
							formValues.condition_day_from?.toString() ?? null
						}
						options={weekdayOptions}
						disabled={pending}
						onChange={(value) =>
							handleChange(
								'condition_day_from',
								value === '' ? null : Number(value),
							)
						}
						error={errors.condition_day_from}
					/>

					<FormComponentSelect<DiscountFormValuesType>
						labelText={
							translations['discount.field.condition_day_to']
						}
						className="w-32"
						id={elementIds.conditionDayTo}
						fieldName="condition_day_to"
						fieldValue={
							formValues.condition_day_to?.toString() ?? null
						}
						options={weekdayOptions}
						disabled={pending}
						onChange={(value) =>
							handleChange(
								'condition_day_to',
								value === '' ? null : Number(value),
							)
						}
						error={errors.condition_day_to}
					/>
				</div>
			</div>

			<FormComponentTextarea<DiscountFormValuesType>
				labelText={translations['discount.field.notes']}
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
