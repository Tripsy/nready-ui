import { useState } from 'react';
import { Icons } from '@/components/icon.component';
import { Button } from '@/components/ui/button';
import { WindowMinimizedInstance } from '@/components/window/window-minimized-instance.component';
import { useModalStore } from '@/stores/window.store';
import type { WindowConfig } from '@/types/window.type';

export function WindowDock({ modals }: { modals: WindowConfig[] }) {
	const [showAll, setShowAll] = useState(false);
	const { closeAll } = useModalStore();

	const reversedModals = [...modals].reverse();
	const displayModals = showAll ? reversedModals : reversedModals.slice(0, 5);
	const hasMore = modals.length > 5;
	const hasWindows = modals.length > 1;

	// `closeAll` clears the whole stack, including the window currently on
	// screen — which is no longer listed here, hence the wording
	const handleCloseAll = () => {
		if (confirm('Close all open windows?')) {
			closeAll();
		}
	};

	return (
		<div className="fixed bottom-4 right-4 ml-4 z-40 md:z-50 flex flex-wrap gap-2">
			{displayModals.map((current) => (
				<WindowMinimizedInstance
					key={`minimized-${current.uid}`}
					current={current}
				/>
			))}
			{hasMore && (
				<div className="flex items-center gap-x-2 border bg-background/95 hover:bg-accent-soft hover:text-accent-soft-foreground shadow-xl px-2 py-1 rounded">
					{!showAll && (
						<Button
							variant="ghost"
							size="xs"
							onClick={() => setShowAll(true)}
							className="hover:bg-transparent hover:text-inherit text-sm"
						>
							<Icons.More size={12} />+{modals.length - 5}
						</Button>
					)}

					{showAll && (
						<Button
							variant="ghost"
							size="xs"
							onClick={() => setShowAll(false)}
							className="hover:bg-transparent hover:text-inherit text-sm"
						>
							<Icons.LessLeft size={12} />
							Show Less
						</Button>
					)}
				</div>
			)}

			{hasWindows && (
				<div className="flex items-center gap-x-2 border bg-background/95 hover:bg-danger/80 hover:text-danger-foreground px-2 py-1 rounded-full transition-colors">
					<Button
						variant="ghost"
						size="xs"
						onClick={handleCloseAll}
						className="hover:bg-transparent hover:text-danger-foreground "
						aria-label="Close all windows"
					>
						<Icons.Close size={12} />
					</Button>
				</div>
			)}
		</div>
	);
}
