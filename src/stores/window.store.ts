import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { getDataSourceConfig } from '@/config/data-source.config';
import ValueError from '@/exceptions/value.error';
import { logger } from '@/helpers/logger.helper';
import { generateWindowUid } from '@/helpers/window.helper';
import {
	clearWindowDraft,
	clearWindowDrafts,
} from '@/helpers/window-draft.helper';
import type { DataSourceKey } from '@/types/data-source.key';
import { DataSourceSectionEnum } from '@/types/data-source.type';
import type {
	WindowConfig,
	WindowCreateConfig,
	WindowDefinition,
} from '@/types/window.type';

type WindowStore = {
	stack: WindowConfig[];
	isHydrated: boolean; // False until `hydrateWindowStore()` has restored the persisted stack
	open: (
		config: WindowCreateConfig,
		replacedUid?: string, // If argument `replacedUid` is provided and a window exists it will be closed
	) => void;
	close: (uid?: string) => void; // Removes from stack
	closeAll: () => void; // Clear stack
	minimize: (uid: string) => void; // Still in stack, hidden
	focus: (uid: string) => void; // Still in stack, visible again
	getWindow: (uid: string) => WindowConfig | undefined; // Get window by uid
	getCurrentWindow: () => WindowConfig | undefined; // Get top window
};

// Helper to prepare config on create
const prepareConfigOnCreate = async (
	config: WindowCreateConfig,
): Promise<WindowConfig> => {
	const enrichedConfig = { ...config };

	switch (enrichedConfig.section) {
		case DataSourceSectionEnum.DASHBOARD:
		case DataSourceSectionEnum.PUBLIC: {
			const actions = await getDataSourceConfig(
				enrichedConfig.section,
				enrichedConfig.dataSource as DataSourceKey,
				'actions',
			);

			if (!actions) {
				throw new ValueError(
					`Actions not defined for ${enrichedConfig.dataSource}`,
				);
			}

			const actionConfig = actions[enrichedConfig.action];

			if (!actionConfig) {
				throw new ValueError(
					`Action "${enrichedConfig.action}" not defined for ${enrichedConfig.dataSource}`,
				);
			}

			const displayEntryLabel = await getDataSourceConfig(
				enrichedConfig.section,
				enrichedConfig.dataSource as DataSourceKey,
				'displayEntryLabel',
			);

			const definition: WindowDefinition = {
				windowType: actionConfig.windowType,
				windowTitle: actionConfig.windowTitle,
				windowComponent: actionConfig.windowComponent,
				entriesSelection: actionConfig.entriesSelection,
				operationFunction:
					actionConfig.operationFunction as WindowDefinition['operationFunction'],
				button: actionConfig.button,
				validateForm: actionConfig.validateForm,
				getFormValues: actionConfig.getFormValues,
				getFormState: actionConfig.getFormState,
				reloadEntry: actionConfig.reloadEntry,
				prepareEntry: actionConfig.prepareEntry,
				displayEntryLabel,
			} as WindowDefinition;

			return {
				...enrichedConfig,
				uid:
					enrichedConfig.uid ??
					generateWindowUid({
						dataSource: enrichedConfig.dataSource,
						action: enrichedConfig.action,
						entriesSelection: actionConfig.entriesSelection,
						entries: enrichedConfig.data?.entries,
					}),
				definition: {
					...definition,
					...enrichedConfig.definition,
				},
				props: {
					...actionConfig.windowConfigProps,
					...enrichedConfig.props,
				},
				events: {
					...actionConfig.events,
					...enrichedConfig.events,
				},
				minimized: enrichedConfig.minimized ?? false,
			};
		}
		default:
			throw new Error(`Invalid section: ${enrichedConfig.section}`);
	}
};

export const useModalStore = create<WindowStore>()(
	devtools(
		persist(
			(set, get) => {
				// Private helper to check if window exists
				const windowExists = (uid: string): boolean => {
					return get().stack.some((window) => window.uid === uid);
				};

				const canMinimize = (window: WindowConfig): boolean =>
					window.props?.allowMinimize ?? true;

				// Makes room for the window identified by `activeUid`: every other
				// window is minimized, except the ones flagged `allowMinimize: false`
				// which are dropped from the stack — they have no dock representation
				// to return from, so parking them would strand them.
				const stackBehind = (
					stack: WindowConfig[],
					activeUid: string,
				): WindowConfig[] => {
					const keptStack = stack.filter(
						(m) => m.uid === activeUid || canMinimize(m),
					);

					// A dropped window is gone for good, so its draft goes with it
					for (const window of stack) {
						if (!keptStack.includes(window)) {
							clearWindowDraft(window.uid);
						}
					}

					return keptStack.map((m) =>
						m.minimized || m.uid === activeUid
							? m
							: { ...m, minimized: true },
					);
				};

				return {
					stack: [],
					isHydrated: false,

					open: (config, replacedUid) => {
						if (replacedUid) {
							get().close(replacedUid);
						}

						prepareConfigOnCreate(config).then((preparedConfig) => {
							const alreadyExists = windowExists(
								preparedConfig.uid,
							);

							set((state) => {
								const minimizedStack = stackBehind(
									state.stack,
									preparedConfig.uid,
								);

								if (!alreadyExists) {
									return {
										stack: [
											...minimizedStack,
											preparedConfig,
										],
									};
								}

								return {
									stack: minimizedStack.map((w) =>
										w.uid === preparedConfig.uid
											? {
													...preparedConfig,
													minimized: false,
												}
											: w,
									),
								};
							});
						});
					},

					close: (uid) => {
						const stack = get().stack;
						const closedStack = uid
							? stack.filter((m) => m.uid === uid)
							: stack.filter((m) => !m.minimized); // Close the visible one

						// Closing is the user discarding the form — the draft goes too
						for (const window of closedStack) {
							clearWindowDraft(window.uid);
						}

						set({
							stack: stack.filter(
								(m) => !closedStack.includes(m),
							),
						});
					},

					closeAll: () => {
						clearWindowDrafts();

						set({ stack: [] });
					},

					// A window flagged `allowMinimize: false` can only be submitted
					// or closed — never parked in the dock.
					minimize: (uid) =>
						set((state) => ({
							stack: state.stack.map((m) =>
								m.uid === uid && canMinimize(m)
									? { ...m, minimized: true }
									: m,
							),
						})),

					focus: (uid) =>
						set((state) => ({
							stack: stackBehind(state.stack, uid).map((m) =>
								m.uid === uid ? { ...m, minimized: false } : m,
							),
						})),

					// Get window by uid
					getWindow: (uid) => {
						return get().stack.find((window) => window.uid === uid);
					},

					// Get current/top window
					getCurrentWindow: () => {
						const stack = get().stack;

						return stack.find((m) => !m.minimized);
					},
				};
			},
			{
				name: 'window-store',

				// Hydration is driven explicitly by `hydrateWindowStore()` below:
				// definitions are lazy-loaded, so restoring the stack is async and
				// cannot happen during the initial (SSR-matched) render.
				skipHydration: true,

				partialize: (state) => ({
					stack: state.stack.map((window) => ({
						uid: window.uid,
						section: window.section,
						dataSource: window.dataSource,
						action: window.action,
						minimized: window.minimized,
						data: window.data,
						props: window.props,
						// Events intentionally omitted — functions are not serializable
					})),
				}),

				// No `onRehydrateStorage`: its callback is not awaited by zustand, so
				// re-deriving there would mutate the state object without notifying
				// subscribers. `hydrateWindowStore()` does it with a real `setState`.
			},
		),
	),
);

let hydrationPromise: Promise<void> | null = null;

/**
 * Restores the persisted window stack. `persist.rehydrate()` only brings back the
 * serialized shells (see `partialize` — no `definition`, no `events`), so each one
 * is re-derived through `prepareConfigOnCreate` and the result is published in a
 * single `setState`. Until that lands, `isHydrated` stays false and consumers must
 * not render the stack: the intermediate entries have no `definition`.
 *
 * Safe to call from several components — the first call wins, the rest await it.
 */
export const hydrateWindowStore = (): Promise<void> => {
	hydrationPromise ??= (async () => {
		await useModalStore.persist.rehydrate();

		const storedStack = useModalStore.getState().stack;

		const results = await Promise.allSettled(
			storedStack.map((window) => prepareConfigOnCreate(window)),
		);

		const restoredStack = results
			.map((result, index) => {
				if (result.status === 'fulfilled') {
					return result.value;
				}

				logger.warn('Failed to rehydrate window', result.reason, {
					uid: storedStack[index].uid,
				});

				return null;
			})
			.filter((window): window is WindowConfig => window !== null);

		useModalStore.setState((state) => {
			// A window opened while hydration was in flight already carries a
			// `definition` — it is fresher than the stored copy, so it wins.
			const openedStack = state.stack.filter(
				(window) => window.definition,
			);
			const openedUids = new Set(openedStack.map((window) => window.uid));

			return {
				stack: [
					...restoredStack.filter(
						(window) => !openedUids.has(window.uid),
					),
					...openedStack,
				],
				isHydrated: true,
			};
		});
	})();

	return hydrationPromise;
};

/**
 * Drops every window and its persisted copy. Called on logout: the stack carries
 * entry data belonging to the session being ended, so it must not survive into the
 * next login on the same browser.
 *
 * Hydration is awaited first — a restore still in flight would otherwise repopulate
 * the stack right after it was cleared.
 */
export const clearWindowStore = async (): Promise<void> => {
	await hydrateWindowStore();

	useModalStore.getState().closeAll(); // Also drops every draft
	useModalStore.persist.clearStorage();
};
