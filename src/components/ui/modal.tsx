import type React from 'react';
import { useCallback, useEffect } from 'react';
import { Icons } from '@/components/icon.component';
import { Button } from '@/components/ui/button';
import { cn } from '@/helpers/css.helper';

const SizeClasses = {
	sm: 'max-w-sm',
	md: 'max-w-md',
	lg: 'max-w-lg',
	xl: 'max-w-xl',
	x2l: 'max-w-2xl',
	x3l: 'max-w-3xl',
	x4l: 'max-w-4xl',
};

export type ModalSizeType = keyof typeof SizeClasses;

interface ModalProps {
	isOpen: boolean;
	isHidden?: boolean;
	onClose: () => void;
	onMinimize?: () => void;
	title?: string;
	description?: string;
	children: React.ReactNode;
	footer?: React.ReactNode;
	size?: ModalSizeType;
	className?: string;
	closeOnBackdrop?: boolean;
	closeOnEscape?: boolean;
}

export function Modal({
	isOpen,
	isHidden = false,
	onClose,
	onMinimize,
	title,
	description,
	children,
	footer,
	size = 'md',
	className,
	closeOnBackdrop = true,
	closeOnEscape = true,
}: ModalProps) {
	const handleEscape = useCallback(
		(e: KeyboardEvent) => {
			if (e.key === 'Escape' && closeOnEscape) {
				onClose();
			}
		},
		[onClose, closeOnEscape],
	);

	// A minimized window stays mounted to preserve its form state, so the lock
	// has to follow `isHidden` too — otherwise a window parked in the dock keeps
	// the page behind it unscrollable
	useEffect(() => {
		if (!isOpen || isHidden) {
			return;
		}

		document.addEventListener('keydown', handleEscape);
		document.body.style.overflow = 'hidden';

		return () => {
			document.removeEventListener('keydown', handleEscape);
			document.body.style.overflow = '';
		};
	}, [isOpen, isHidden, handleEscape]);

	if (!isOpen) {
		return null;
	}

	return (
		<div
			role="dialog"
			className={cn(
				'fixed inset-0 z-50 flex items-center justify-center p-4',
				isHidden && 'hidden',
			)}
		>
			{/* Backdrop */}
			<div
				className="absolute inset-0 bg-foreground/20 backdrop-blur-sm animate-fade-in"
				onClick={closeOnBackdrop ? onClose : undefined}
				aria-hidden="true"
			/>

			{/* Modal content */}
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby={title ? 'modal-title' : undefined}
				aria-describedby={description ? 'modal-description' : undefined}
				className={cn(
					'relative w-full bg-surface rounded-xl shadow-xl border border-border animate-scale-in flex flex-col',
					'max-h-[90vh]', // Limit height to 90% of viewport
					className,
					SizeClasses[size],
				)}
			>
				{/* Header - Fixed */}
				{(title || description) && (
					<div className="px-6 pt-6 pb-4 shrink-0">
						{title && (
							<h2
								id="modal-title"
								className="text-lg font-semibold text-surface-foreground pr-8" // Add padding for close button
							>
								{title}
							</h2>
						)}
						{description && (
							<p
								id="modal-description"
								className="text-sm text-muted mt-1"
							>
								{description}
							</p>
						)}
					</div>
				)}

				{/* Control buttons - Fixed */}
				<div className="absolute right-4 top-4 z-10 flex gap-2">
					{/* Rendered only when a handler is given — a modal without
					    `onMinimize` has nowhere to minimize to */}
					{onMinimize && (
						<Button
							variant="ghost"
							size="xs"
							className="rounded-full p-1"
							hover="warning"
							onClick={onMinimize}
							aria-label="Minimize modal"
						>
							<Icons.Minimize />
						</Button>
					)}
					<Button
						variant="ghost"
						size="xs"
						className="rounded-full p-1"
						hover="error"
						onClick={onClose}
						aria-label="Close modal"
					>
						<Icons.Close />
					</Button>
				</div>

				{/* Body - Scrollable */}
				<div className="px-6 py-2 overflow-y-auto flex-1">
					{children}
				</div>

				{/* Footer - Fixed */}
				{footer && (
					<div className="px-6 pb-6 pt-4 flex justify-end gap-3 shrink-0 border-t border-border mt-2">
						{footer}
					</div>
				)}
			</div>
		</div>
	);
}
