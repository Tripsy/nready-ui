import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { dispatchFilterReset } from '@/app/(dashboard)/_events/data-table-filter-reset.event';
import { logRejection } from '@/helpers/logger.helper';
import { WINDOW_CACHE_LABEL } from '@/helpers/window.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import { useToast } from '@/providers/toast.provider';
import { useModalStore } from '@/stores/window.store';
import type { ActionEventType } from '@/types/action.type';
import type { DataSourceKey } from '@/types/data-source.key';
import { DataSourceSectionEnum } from '@/types/data-source.type';
import type { FormStateType, FormValuesType } from '@/types/form.type';
import type { WindowConfig } from '@/types/window.type';

type UseWindowFormProcessedParams<FormValues extends FormValuesType, Entry> = {
	state: FormStateType<FormValues>;
	windowConfig: WindowConfig;
	windowEvents?: Record<string, ActionEventType<Entry>>;
	entryId?: number;
};

export function useWindowFormProcessed<
	FormValues extends FormValuesType,
	Entry,
>({
	state,
	windowConfig,
	windowEvents,
	entryId,
}: UseWindowFormProcessedParams<FormValues, Entry>) {
	const { close } = useModalStore();
	const { showToast } = useToast();
	const queryClient = useQueryClient();

	const actionLabelKey = `${windowConfig.dataSource}.action.${windowConfig.action}.label`;
	const successMessageKey = `${windowConfig.dataSource}.action.${windowConfig.action}.success`;

	const translationsKeys = [
		successMessageKey,
		actionLabelKey,
		'app.success.title',
	] as const;

	const { translations } = useTranslation(translationsKeys);

	const handleFormProcessed = useCallback(
		async (situation: string, resultData?: Entry) => {
			if (situation === 'success') {
				showToast({
					severity: 'success',
					summary: translations['app.success.title'],
					detail: translations[successMessageKey],
				});

				if (windowConfig.section === DataSourceSectionEnum.DASHBOARD) {
					dispatchFilterReset(
						windowConfig.dataSource as DataSourceKey,
					);
				}

				// Invalidate reloaded entry cache on update
				if (windowConfig.action === 'update' && entryId) {
					const windowDefinition = windowConfig?.definition;

					if (windowDefinition?.reloadEntry) {
						await queryClient.invalidateQueries({
							queryKey: [
								WINDOW_CACHE_LABEL,
								windowConfig.uid,
								entryId,
							],
						});
					}
				}

				close(windowConfig.uid);
			}

			windowEvents?.[situation]?.(resultData);
		},
		[
			windowEvents,
			showToast,
			translations,
			successMessageKey,
			windowConfig,
			entryId,
			queryClient,
			close,
		],
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: Fire on situation transitions, not when handleFormProcessed re-creates due to translation reloads or config changes.
	useEffect(() => {
		if (state.situation === 'success') {
			handleFormProcessed(
				state.situation,
				state.resultData as Entry,
			).catch(logRejection('Post-submit form handling failed'));
		}
	}, [state.situation]);
}
