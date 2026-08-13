'use client';

import { useQuery } from '@tanstack/react-query';

import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { formatDate } from '@/helpers/date.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import {
	type DiscountModel,
	DiscountScopeEnum,
	displayDiscountValue,
} from '@/models/discount.model';
import { requestDiscountTargets } from '@/services/discount.service';

const WEEKDAYS = [
	'Monday',
	'Tuesday',
	'Wednesday',
	'Thursday',
	'Friday',
	'Saturday',
	'Sunday',
];

/** ISO weekday to name; the array is 0-based and Monday is 1. */
const weekdayName = (day: number) => WEEKDAYS[day - 1] ?? String(day);

/** One readable line per condition, in the order the form presents them. */
function describeConditions(conditions: DiscountModel['conditions']): string[] {
	if (!conditions) {
		return [];
	}

	const lines: string[] = [];

	if (conditions.min_order_value !== undefined) {
		lines.push(
			`Order value at least ${conditions.min_order_value} (base currency, excl. VAT)`,
		);
	}

	if (conditions.applicable_countries?.length) {
		lines.push(
			`Country is one of ${conditions.applicable_countries.join(', ')}`,
		);
	}

	if (conditions.hour_range) {
		const [from, to] = conditions.hour_range;

		lines.push(
			`Between ${from}:00 and ${to}:59${from > to ? ' (overnight)' : ''}`,
		);
	}

	if (conditions.day_range) {
		const [from, to] = conditions.day_range;

		lines.push(
			`${weekdayName(from)} to ${weekdayName(to)}${from > to ? ' (wraps the week)' : ''}`,
		);
	}

	return lines;
}

export function ViewDiscount({ entry }: { entry: DiscountModel }) {
	const conditionLines = describeConditions(entry.conditions);

	const hasTargets = entry.scope !== DiscountScopeEnum.ORDER;

	// Targets live behind their own endpoint, so the entry alone cannot show them.
	const { data: targets, isLoading: targetsLoading } = useQuery({
		queryKey: ['discount', 'targets', entry.id],
		queryFn: () => requestDiscountTargets(entry.id),
		enabled: hasTargets,
		/*
		 * Overrides the provider's 5-minute `staleTime`: this data is written by the manage
		 * form through a different endpoint, so a cached copy is wrong the moment a submit
		 * succeeds. It is a handful of ids — refetching per mount is cheaper than reasoning
		 * about who has to invalidate it.
		 */
		staleTime: 0,
		refetchOnMount: 'always',
	});

	const targetIds =
		entry.scope === DiscountScopeEnum.ORDER
			? []
			: (targets?.[entry.scope] ?? []);

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">ID</span> {entry.id}
				<span className="ml-2">{entry.label}</span>
			</div>

			<ViewSection title="Discount">
				<ViewField label="Scope" value={formatEnumLabel(entry.scope)} />
				<ViewField
					label="Reason"
					value={formatEnumLabel(entry.reason)}
				/>
				<ViewField label="Type" value={formatEnumLabel(entry.type)} />
				<ViewField label="Value" value={displayDiscountValue(entry)} />
				<ViewField label="Reference" value={entry.reference} />
			</ViewSection>

			<ViewSection title="Availability">
				<ViewField
					label="Start At"
					value={
						entry.start_at
							? formatDate(entry.start_at, 'date-time')
							: null
					}
				/>
				<ViewField
					label="End At"
					value={
						entry.end_at
							? formatDate(entry.end_at, 'date-time')
							: null
					}
				/>
			</ViewSection>

			{hasTargets && (
				<ViewSection title="Targets">
					<ViewField
						label={formatEnumLabel(entry.scope)}
						value={
							targetsLoading
								? 'Loading…'
								: targetIds.length === 0
									? null
									: targetIds.map((id) => `#${id}`).join(', ')
						}
						full
					/>
				</ViewSection>
			)}

			<ViewSection title="Other">
				<ViewField
					label="Conditions"
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
				<ViewField label="Notes" value={entry.notes} full />
			</ViewSection>

			<ViewSection title="Timestamps">
				<ViewField
					label="Created At"
					value={formatDate(entry.created_at, 'date-time')}
				/>
				<ViewField
					label="Updated At"
					value={formatDate(entry.updated_at, 'date-time')}
				/>
				{entry.deleted_at && (
					<ViewField
						label="Deleted At"
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
