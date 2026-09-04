import {
	FormComponentCheckbox,
	FormComponentSelect,
	FormComponentTime,
} from '@/components/form/form-element.component';
import { Icons } from '@/components/icon.component';
import { Button } from '@/components/ui/button';
import { ISO_WEEKDAYS } from '@/helpers/date.helper';
import { ownErrorMessages, rowErrorsAt } from '@/helpers/form.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import type { ProductAvailabilityType } from '@/models/product.model';

/**
 * A window as the form holds it: the stored shape plus client-only row identity.
 *
 * `key` is needed for the same reason the variants editor needs one — a window has no id until it
 * is saved, and nothing in the row is unique either (two windows on the same weekday at different
 * hours are both legitimate), so the array index is the only alternative, and it shifts on removal.
 */
export type ProductAvailabilityFormType = ProductAvailabilityType & {
	key: string;
};

let availabilityKeySequence = 0;

/**
 * Not `crypto.randomUUID()`: that needs a secure context, and the dev host is plain http, so it
 * would throw where it is most convenient to test. Uniqueness only has to hold within one form.
 */
export function nextAvailabilityKey(): string {
	availabilityKeySequence += 1;

	return `availability-${availabilityKeySequence}`;
}

/** The hours an interval falls back to when All day is unticked and it has none yet. */
const DEFAULT_HOURS = { starts_at: '09:00', ends_at: '17:00' } as const;

export function emptyAvailability(): ProductAvailabilityFormType {
	return {
		key: nextAvailabilityKey(),
		// Every day, which is the useful default for the first interval someone adds.
		day_of_week: null,
		...DEFAULT_HOURS,
	};
}

/** `null` is a real choice here — "every day" — so it needs a value of its own in the select. */
const EVERY_DAY = 'all';

/**
 * Shared widths for the window grid's header and its rows — the same tokens on both, change one
 * and the columns drift.
 *
 * The header spans are not `<label>`s, so they name nothing to a screen reader: each cell below
 * repeats its column name as `ariaLabel`, which is the only accessible name those controls have.
 * Keep the two in step.
 */
const WINDOW_COLUMN = {
	day: 'w-40 shrink-0',
	allDay: 'w-20 shrink-0',
	hours: 'w-32 shrink-0',
} as const;

const weekdayOptions = [
	{ label: 'Every day', value: EVERY_DAY },
	...ISO_WEEKDAYS.map((day) => ({
		label: day.label,
		value: String(day.value),
	})),
];

function AvailabilityRow({
	availability,
	index,
	pending,
	errors,
	onChange,
	onRemove,
}: {
	availability: ProductAvailabilityFormType;
	index: number;
	pending: boolean;
	errors: unknown;
	onChange: (value: ProductAvailabilityFormType) => void;
	onRemove: () => void;
}) {
	const elementIds = useElementIds([
		`availability-day-${availability.key}`,
		`availability-all-day-${availability.key}`,
		`availability-starts-${availability.key}`,
		`availability-ends-${availability.key}`,
	] as const);

	const rowErrors = rowErrorsAt<ProductAvailabilityFormType>(errors, index);

	/*
	 * The two columns are null together — that is the stored shape of a whole-day window, and a
	 * check constraint refuses a half-filled one. So the toggle writes both or clears both, and
	 * reads from `starts_at` alone rather than needing a flag of its own in the form values.
	 */
	const isAllDay = !availability.starts_at;

	return (
		<div className="flex flex-nowrap items-start gap-2">
			<div className={WINDOW_COLUMN.day}>
				<FormComponentSelect<ProductAvailabilityFormType>
					id={elementIds[`availability-day-${availability.key}`]}
					fieldName="day_of_week"
					fieldValue={
						availability.day_of_week === null
							? EVERY_DAY
							: String(availability.day_of_week)
					}
					ariaLabel="Day"
					className="w-full"
					options={weekdayOptions}
					disabled={pending}
					onChange={(value) =>
						onChange({
							...availability,
							day_of_week:
								value === EVERY_DAY ? null : Number(value),
						})
					}
					error={ownErrorMessages(rowErrors?.day_of_week)}
				/>
			</div>

			{/*
			 * The box alone, its name in the column header. The `sr-only` text is what a
			 * screen reader reads, since a checkbox takes its accessible name from its own
			 * content rather than an `ariaLabel` prop.
			 */}
			<div
				className={`${WINDOW_COLUMN.allDay} flex justify-center pt-2.5`}
			>
				<FormComponentCheckbox<ProductAvailabilityFormType>
					id={elementIds[`availability-all-day-${availability.key}`]}
					fieldName="starts_at"
					checked={isAllDay}
					disabled={pending}
					onCheckedChange={(checked) =>
						onChange({
							...availability,
							...(checked
								? { starts_at: null, ends_at: null }
								: DEFAULT_HOURS),
						})
					}
				>
					<span className="sr-only">All day</span>
				</FormComponentCheckbox>
			</div>

			{/*
			 * Disabled rather than removed while All day is ticked: dropping the two cells
			 * would close the gap and leave the row misaligned with the header. Both read
			 * empty, which is the stored shape of a whole-day window.
			 */}
			<div className={WINDOW_COLUMN.hours}>
				<FormComponentTime<ProductAvailabilityFormType>
					id={elementIds[`availability-starts-${availability.key}`]}
					fieldName="starts_at"
					fieldValue={availability.starts_at}
					isRequired={!isAllDay}
					ariaLabel="From"
					className="w-full"
					minuteInterval={5}
					disabled={pending || isAllDay}
					// `FormComponentTime` reports through a synthetic change event carrying
					// `HH:MM`, not a bare value.
					onChange={(event) =>
						onChange({
							...availability,
							starts_at: event.target.value,
						})
					}
					error={ownErrorMessages(rowErrors?.starts_at)}
				/>
			</div>

			<div className={WINDOW_COLUMN.hours}>
				<FormComponentTime<ProductAvailabilityFormType>
					id={elementIds[`availability-ends-${availability.key}`]}
					fieldName="ends_at"
					fieldValue={availability.ends_at}
					isRequired={!isAllDay}
					ariaLabel="Until"
					className="w-full"
					minuteInterval={5}
					disabled={pending || isAllDay}
					onChange={(event) =>
						onChange({
							...availability,
							ends_at: event.target.value,
						})
					}
					error={ownErrorMessages(rowErrors?.ends_at)}
				/>
			</div>

			<Button
				type="button"
				variant="ghost"
				hover="error"
				className="mt-1 p-2 opacity-60 hover:opacity-100"
				disabled={pending}
				onClick={onRemove}
				aria-label={`Remove interval ${index + 1}`}
				title="Remove interval"
			>
				<Icons.Close className="h-4 w-4" />
			</Button>
		</div>
	);
}

/**
 * The product's recurring ordering windows — which weekdays and between which hours it can be
 * ordered.
 *
 * **An empty list means unrestricted**, which is why there is no seeded first row and why the
 * empty state says so rather than reading as something unfinished. This is the opposite default
 * from the variants editor, where at least one row is required.
 *
 * A row with **All day** ticked is a weekday and no hours — "available on Sundays". Note that
 * ticking it on a row set to *every* day restricts nothing, which is what an empty list already
 * says; the row is redundant rather than wrong, so nothing refuses it.
 *
 * These windows do not touch `sale_status`: a product outside its hours is still `available` in
 * the catalog, just not orderable right now. The absolute dates on the Details tab are the ones
 * that decide whether it is listed at all.
 */
export function FormAvailabilityProduct({
	value,
	pending,
	errors,
	onChange,
}: {
	value: ProductAvailabilityFormType[];
	pending: boolean;
	errors: unknown;
	onChange: (value: ProductAvailabilityFormType[]) => void;
}) {
	return (
		<div className="space-y-3">
			{value.length === 0 ? (
				<p className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-muted">
					No intervals — the product can be ordered at any time while
					it is available.
				</p>
			) : (
				<>
					{/*
					 * The column labels, once, so a second window reads as another line of the
					 * same table rather than a second copy of the panel.
					 *
					 * No required marker on the hours: they are required only while All day is
					 * unticked, and one header cannot say that for rows that differ.
					 */}
					<div className="flex flex-nowrap gap-2 text-sm font-semibold">
						<span className={WINDOW_COLUMN.day}>Day</span>
						<span className={`${WINDOW_COLUMN.allDay} text-center`}>
							All day
						</span>
						<span className={WINDOW_COLUMN.hours}>From</span>
						<span className={WINDOW_COLUMN.hours}>Until</span>
					</div>

					{value.map((availability, index) => (
						<AvailabilityRow
							key={availability.key}
							availability={availability}
							index={index}
							pending={pending}
							errors={errors}
							onChange={(next) =>
								onChange(
									value.map((entry, entryIndex) =>
										entryIndex === index ? next : entry,
									),
								)
							}
							onRemove={() =>
								onChange(
									value.filter(
										(_, entryIndex) => entryIndex !== index,
									),
								)
							}
						/>
					))}
				</>
			)}

			<div className="flex justify-end">
				<Button
					type="button"
					variant="ghost"
					hover="success"
					className="p-2 opacity-80 hover:opacity-100"
					disabled={pending}
					onClick={() => onChange([...value, emptyAvailability()])}
					title="Add interval"
				>
					<Icons.Action.Add className="h-4 w-4" />
					Add interval
				</Button>
			</div>

			{/*
			 * The whole list in one hidden field — per-input names cannot express a repeatable,
			 * and `getFormValues` parses this back.
			 */}
			<input
				type="hidden"
				name="availabilities"
				value={JSON.stringify(value)}
			/>
		</div>
	);
}
