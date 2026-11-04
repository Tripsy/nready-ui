'use client';

import type React from 'react';
import { Icons } from '@/components/icon.component';
import { cn } from '@/helpers/css.helper';
import { useTranslation } from '@/hooks/use-translation.hook';

const TRANSLATION_KEYS = [
	'app.action.loading.title',
	'app.action.loading.label',
	'app.error.title',
	'app.error.description',
	'app.success.title',
	'app.success.description',
	'app.info.title',
	'app.info.generic',
] as const;

type StatusProps = {
	children?: React.ReactNode;
	title?: string;
	description?: string;
	className?: string;
};

// Loading
export function LoadingIcon({ className }: { className?: string }) {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	return (
		<Icons.Status.Loading
			className={cn('animate-spin', className)}
			aria-label={translations['app.action.loading.title']}
		/>
	);
}

export function LoadingContent({ children, title, description }: StatusProps) {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	return (
		<div className="flex items-center justify-center w-full px-4 py-12 ">
			<div className="text-center">
				<div className="flex justify-center mb-4">
					<LoadingIcon className="w-12 h-12 text-warning bg-warning/10 rounded-full p-3" />
				</div>
				<h1 className="text-2xl font-bold mb-8">
					{title ?? translations['app.action.loading.title']}
				</h1>
				<p className="text-muted">
					{description ?? translations['app.action.loading.label']}
				</p>
			</div>
			{children}
		</div>
	);
}

export function LoadingComponent({
	children,
	title,
	description,
	className,
}: StatusProps) {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	return (
		<div
			className={cn(
				'min-h-[calc(80vh-4rem)] flex items-center justify-center px-4 py-12',
				className,
			)}
		>
			<div className="w-full max-w-md">
				<div className="text-center">
					<div className="flex justify-center mb-4">
						<LoadingIcon className="w-12 h-12 text-warning bg-warning/10 rounded-full p-3" />
					</div>
					<h1 className="text-2xl font-bold mb-8">
						{title ?? translations['app.action.loading.title']}
					</h1>
					<p className="text-muted">
						{description ??
							translations['app.action.loading.label']}
					</p>
				</div>
				{children}
			</div>
		</div>
	);
}

// Error
export const ErrorIcon = ({ className }: { className?: string }) => (
	<Icons.Status.Error className={cn('inline-block w-6 h-6', className)} />
);

export function ErrorComponent({
	children,
	title,
	description,
	className,
}: StatusProps) {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	return (
		<div
			className={cn(
				'min-h-[calc(80vh-4rem)] flex items-center justify-center px-4 py-12',
				className,
			)}
		>
			<div className="w-full max-w-md">
				<div className="text-center">
					<div className="flex justify-center mb-4">
						<ErrorIcon className="w-12 h-12 text-danger bg-danger/10 rounded-full p-3" />
					</div>
					<h1 className="text-2xl font-bold mb-8">
						{title ?? translations['app.error.title']}
					</h1>
					<p className="text-muted">
						{description ?? translations['app.error.description']}
					</p>
				</div>
				{children}
			</div>
		</div>
	);
}

// Success
export function SuccessComponent({
	children,
	title,
	description,
	className,
}: StatusProps) {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	return (
		<div
			className={cn(
				'min-h-[calc(80vh-4rem)] flex items-center justify-center px-4 py-12',
				className,
			)}
		>
			<div className="w-full max-w-md">
				<div className="text-center">
					<div className="flex justify-center mb-4">
						<Icons.Status.Success className="w-12 h-12 text-success bg-success/30 rounded-full p-3" />
					</div>
					<h1 className="text-2xl font-bold mb-8">
						{title ?? translations['app.success.title']}
					</h1>
					<p className="text-muted">
						{description ?? translations['app.success.description']}
					</p>
				</div>
				{children}
			</div>
		</div>
	);
}

// Info
export function InfoComponent({
	children,
	title,
	description,
	className,
}: StatusProps) {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	return (
		<div
			className={cn(
				'min-h-[calc(80vh-4rem)] flex items-center justify-center px-4 py-12',
				className,
			)}
		>
			<div className="w-full max-w-md">
				<div className="text-center">
					<div className="flex justify-center mb-4">
						<Icons.Info className="w-12 h-12 text-info bg-info/30 rounded-full p-3" />
					</div>
					<h1 className="text-2xl font-bold mb-8">
						{title ?? translations['app.info.title']}
					</h1>
					<p className="text-muted">
						{description ?? translations['app.info.generic']}
					</p>
				</div>
				{children}
			</div>
		</div>
	);
}
