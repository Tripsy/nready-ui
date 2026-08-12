'use client';

import { useEffect } from 'react';
import { WindowDock } from '@/components/window/window-dock.component';
import { WindowInstance } from '@/components/window/window-instance.component';
import { logRejection } from '@/helpers/logger.helper';
import { hydrateWindowStore, useModalStore } from '@/stores/window.store';
import type { WindowConfig } from '@/types/window.type';

export function WindowContainer({
	section,
}: {
	section: WindowConfig['section'];
}) {
	const { stack, isHydrated } = useModalStore();

	// Hydration restores the whole stack, not this container's section, so it runs once —
	// no `section` in the log context either, which would drag it into the dependencies.
	useEffect(() => {
		hydrateWindowStore().catch(
			logRejection('Window store hydration failed'),
		);
	}, []);

	// Windows restored from storage have no `definition` until hydration completes
	if (!isHydrated) {
		return null;
	}

	const modals = stack.filter((m) => m.section === section);
	const minimizedModals = modals.filter((m) => m.minimized);

	return (
		<>
			{modals.map((current) => {
				const isForm = current.definition.windowType === 'form';
				const isMinimized = current.minimized;

				// Non-form windows: unmount when minimized, no state to preserve
				if (!isForm && isMinimized) {
					return null;
				}

				return (
					<WindowInstance
						key={current.uid}
						current={current}
						isHidden={isMinimized}
					/>
				);
			})}

			{/* The dock is the way back to a minimized window — the visible one
			    is already on screen, so it gets no chip */}
			{minimizedModals.length > 0 && (
				<WindowDock modals={minimizedModals} />
			)}
		</>
	);
}
