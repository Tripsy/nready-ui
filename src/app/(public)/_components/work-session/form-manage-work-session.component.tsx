import {
	FormComponentCalendar,
	FormComponentTime,
} from '@/components/form/form-element.component';
import {
	createFutureDate,
	createPastDate,
	formatDate,
} from '@/helpers/date.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useTranslation } from '@/hooks/use-translation.hook';
import {
	END_AT_MAX_FUTURE_SECONDS,
	START_AT_MAX_PAST_SECONDS,
} from '@/models/work-session.model';
import { useAuth } from '@/providers/auth.provider';
import { useWindowForm } from '@/providers/window-form.provider';
import { useModalStore } from '@/stores/window.store';

export type WorkSessionFormValuesType = {
	start_at: string | null;
	start_at_time: string | null;
};

const TRANSLATION_KEYS = [
	'work-session.field.start_date',
	'work-session.field.start_time',
] as const;

export function FormManageWorkSession() {
	const { auth } = useAuth();
	const { getCurrentWindow, close } = useModalStore();

	const windowConfig = getCurrentWindow();

	const { formValues, errors, handleChange, pending } =
		useWindowForm<WorkSessionFormValuesType>();

	const { translations } = useTranslation(TRANSLATION_KEYS);

	const elementIds = useElementIds(['start_at', 'start_at_time'] as const);

	const minDate = createPastDate(START_AT_MAX_PAST_SECONDS);
	const minTime = formatDate(minDate, 'time');

	const maxDate = createFutureDate(END_AT_MAX_FUTURE_SECONDS);

	if (!auth) {
		close(windowConfig?.uid);

		return null;
	}

	return (
		<div className="flex flex-wrap gap-2">
			<FormComponentCalendar<WorkSessionFormValuesType>
				labelText={translations['work-session.field.start_date']}
				id={elementIds.start_at}
				fieldName="start_at"
				fieldValue={formValues.start_at ?? ''}
				isRequired={true}
				disabled={pending}
				onSelect={(value) => handleChange('start_at', value)}
				minDate={minDate}
				maxDate={maxDate}
				error={errors.start_at}
			/>
			<FormComponentTime<WorkSessionFormValuesType>
				labelText={translations['work-session.field.start_time']}
				id={elementIds.start_at_time}
				fieldName="start_at_time"
				fieldValue={formValues.start_at_time ?? ''}
				isRequired={true}
				placeholderText="e.g.: 10:30"
				disabled={pending}
				onChange={(e) => handleChange('start_at_time', e.target.value)}
				error={errors.start_at_time}
				minTime={minTime ?? ''}
				minuteInterval={5}
			/>
		</div>
	);
}
