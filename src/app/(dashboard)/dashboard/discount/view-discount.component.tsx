'use client';

import { useQuery } from '@tanstack/react-query';

import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { findTargetLabels } from '@/app/(dashboard)/dashboard/discount/target-source';
import {
	formatDate,
	ISO_WEEKDAY_KEYS,
	ISO_WEEKDAYS,
} from '@/helpers/date.helper';
import {
	enumTranslationKeys,
	replaceVars,
	translateEnumLabel,
} from '@/helpers/string.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import {
	type DiscountModel,
	DiscountReasonEnum,
	DiscountScopeEnum,
	DiscountTypeEnum,
	displayDiscountValue,
	getDiscountTargetScope,
} from '@/models/discount.model';
import { requestDiscountTargets } from '@/services/discount.service';

const TRANSLATION_KEYS = [
	'discount.field.conditions',
	'discount.field.created_at',
	'discount.field.deleted_at',
	'discount.field.end_at',
	'discount.field.id',
	'discount.field.notes',
	'discount.field.reason',
	'discount.field.reference',
	'discount.field.scope',
	'discount.field.start_at',
	'discount.field.type',
	'discount.field.updated_at',
	'discount.field.value',
	'discount.section.availability',
	'discount.section.discount',
	'discount.section.other',
	'discount.section.targets',
	'discount.section.timestamps',
	'discount.text.condition_min_order',
	'discount.text.condition_countries',
	'discount.text.condition_hours',
	'discount.text.condition_hours_overnight',
	'discount.text.condition_days',
	'discount.text.condition_days_wrap',
	'app.action.loading.label',
	...ISO_WEEKDAY_KEYS,
	...enumTranslationKeys('discount.enum.scope', DiscountScopeEnum),
	...enumTranslationKeys('discount.enum.reason', DiscountReasonEnum),
	...enumTranslationKeys('discount.enum.type', DiscountTypeEnum),
] as const;

/** One readable line per condition, in the order the form presents them. */
function describeConditions(
	conditions: DiscountModel['conditions'],
	translations: Readonly<Record<string, string>>,
): string[] {
	if (!conditions) {
		return [];
	}

	const lines: string[] = [];

	if (conditions.min_order_value !== undefined) {
		lines.push(
			replaceVars(translations['discount.text.condition_min_order'], {
				value: conditions.min_order_value,
			}),
		);
	}

	if (conditions.applicable_countries?.length) {
		lines.push(
			replaceVars(translations['discount.text.condition_countries'], {
				countries: conditions.applicable_countries.join(', '),
			}),
		);
	}

	if (conditions.hour_range) {
		const [from, to] = conditions.hour_range;

		lines.push(
			replaceVars(
				translations[
					from > to
						? 'discount.text.condition_hours_overnight'
						: 'discount.text.condition_hours'
				],
				{ from, to },
			),
		);
	}

	if (conditions.day_range) {
		const [from, to] = conditions.day_range;

		const dayName = (day: number) => {
			const labelKey = ISO_WEEKDAYS.find(
				(weekday) => weekday.value === day,
			)?.labelKey;

			return labelKey ? translations[labelKey] : String(day);
		};

		lines.push(
			replaceVars(
				translations[
					from > to
						? 'discount.text.condition_days_wrap'
						: 'discount.text.condition_days'
				],
				{ from: dayName(from), to: dayName(to) },
			),
		);
	}

	return lines;
}

export function ViewDiscount({ entry }: { entry: DiscountModel }) {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const conditionLines = describeConditions(entry.conditions, translations);

	const targetScope = getDiscountTargetScope(entry.scope);

	// Targets live behind their own endpoint, so the entry alone cannot show them.
	const { data: targets, isLoading: targetsLoading } = useQuery({
		queryKey: ['discount', 'targets', entry.id],
		queryFn: () => requestDiscountTargets(entry.id),
		enabled: targetScope !== null,
		/*
		 * Overrides the provider's 5-minute `staleTime`: this data is written by the manage
		 * form through a different endpoint, so a cached copy is wrong the moment a submit
		 * succeeds. It is a handful of ids - refetching per mount is cheaper than reasoning
		 * about who has to invalidate it.
		 */
		staleTime: 0,
		refetchOnMount: 'always',
	});

	const targetIds = targetScope ? (targets?.[targetScope] ?? []) : [];

	/*
	 * The targets endpoint returns ids and nothing else - it is the polymorphic link table, which
	 * by design knows no more about a category than its number. The names come from the listing
	 * each scope is served by, one request for the whole set.
	 */
	const { data: targetLabels } = useQuery({
		queryKey: ['discount', 'target-labels', targetScope, targetIds],
		// biome-ignore lint/style/noNonNullAssertion: gated by `enabled`
		queryFn: () => findTargetLabels(targetScope!, targetIds),
		enabled: targetScope !== null && targetIds.length > 0,
	});

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">
					{translations['discount.field.id']}
				</span>{' '}
				{entry.id}
				<span className="ml-2">{entry.label}</span>
			</div>

			<ViewSection title={translations['discount.section.discount']}>
				<ViewField
					label={translations['discount.field.scope']}
					value={translateEnumLabel(
						translations,
						'discount.enum.scope',
						entry.scope,
					)}
				/>
				<ViewField
					label={translations['discount.field.reason']}
					value={translateEnumLabel(
						translations,
						'discount.enum.reason',
						entry.reason,
					)}
				/>
				<ViewField
					label={translations['discount.field.type']}
					value={translateEnumLabel(
						translations,
						'discount.enum.type',
						entry.type,
					)}
				/>
				<ViewField
					label={translations['discount.field.value']}
					value={displayDiscountValue(entry)}
				/>
				<ViewField
					label={translations['discount.field.reference']}
					value={entry.reference}
				/>
			</ViewSection>

			<ViewSection title={translations['discount.section.availability']}>
				<ViewField
					label={translations['discount.field.start_at']}
					value={
						entry.start_at
							? formatDate(entry.start_at, 'date-time')
							: null
					}
				/>
				<ViewField
					label={translations['discount.field.end_at']}
					value={
						entry.end_at
							? formatDate(entry.end_at, 'date-time')
							: null
					}
				/>
			</ViewSection>

			{targetScope && (
				<ViewSection title={translations['discount.section.targets']}>
					<ViewField
						label={translateEnumLabel(
							translations,
							'discount.enum.scope',
							entry.scope,
						)}
						value={
							targetsLoading
								? translations['app.action.loading.label']
								: targetIds.length === 0
									? null
									: targetIds
											.map(
												(id) =>
													targetLabels?.[id] ??
													`#${id}`,
											)
											.join(', ')
						}
						full
					/>
				</ViewSection>
			)}

			<ViewSection title={translations['discount.section.other']}>
				<ViewField
					label={translations['discount.field.conditions']}
					value={
						conditionLines.length > 0 ? (
							<ul className="space-y-1">
								{conditionLines.map((line) => (
									<li key={line}>{line}</li>
								))}
							</ul>
						) : null
					}
					full
				/>
				<ViewField
					label={translations['discount.field.notes']}
					value={entry.notes}
					full
				/>
			</ViewSection>

			<ViewSection title={translations['discount.section.timestamps']}>
				<ViewField
					label={translations['discount.field.created_at']}
					value={formatDate(entry.created_at, 'date-time')}
				/>
				<ViewField
					label={translations['discount.field.updated_at']}
					value={formatDate(entry.updated_at, 'date-time')}
				/>
				{entry.deleted_at && (
					<ViewField
						label={translations['discount.field.deleted_at']}
						value={
							<span className="text-danger">
								{formatDate(entry.deleted_at, 'date-time')}
							</span>
						}
					/>
				)}
			</ViewSection>
		</div>
	);
}
