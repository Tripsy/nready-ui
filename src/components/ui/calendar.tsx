import { Calendar as HeroCalendar } from '@heroui/react';
import type * as React from 'react';

export type CalendarProps = React.ComponentProps<typeof HeroCalendar>;

/**
 * HeroUI's Calendar is fully compound and ships no default children, so the standard
 * month view has to be assembled: header (prev / heading / next) plus a grid whose
 * header and body take render functions. `NavButton`, `Heading` and `Cell` supply
 * their own contents — chevrons, the month label and the day number respectively.
 *
 * Values are `@internationalized/date` `DateValue`s, not JS `Date`s; see
 * `FormComponentCalendarWithoutFormElement` for the conversion to the project's
 * `YYYY-MM-DD` strings.
 */
const Calendar = (props: CalendarProps) => (
	<HeroCalendar {...props}>
		<HeroCalendar.Header>
			<HeroCalendar.NavButton slot="previous" />
			<HeroCalendar.Heading />
			<HeroCalendar.NavButton slot="next" />
		</HeroCalendar.Header>
		<HeroCalendar.Grid>
			<HeroCalendar.GridHeader>
				{(day) => (
					<HeroCalendar.HeaderCell>{day}</HeroCalendar.HeaderCell>
				)}
			</HeroCalendar.GridHeader>
			<HeroCalendar.GridBody>
				{(date) => <HeroCalendar.Cell date={date} />}
			</HeroCalendar.GridBody>
		</HeroCalendar.Grid>
	</HeroCalendar>
);

export { Calendar };
