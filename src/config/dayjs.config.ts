import dayjs from 'dayjs';
import 'dayjs/locale/ro';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import relativeTime from 'dayjs/plugin/relativeTime';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(customParseFormat);
dayjs.extend(timezone);
dayjs.extend(relativeTime);

/*
 * `ro` is imported for its side effect - the locale registers itself on the shared dayjs
 * instance - and `en` ships built in, so both are available to `.locale(...)`.
 *
 * The global default is deliberately left at `en`. `dayjs.locale('ro')` mutates the module
 * for every caller, and one Node process serves requests for both languages concurrently, so
 * a per-request global would leak across them. Formatting takes the language per call
 * instead: `date.helper.ts` applies it to the instance, which is scoped to that one format.
 */

export default dayjs;
