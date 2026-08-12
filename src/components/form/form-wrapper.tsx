import type React from 'react';

type FormWrapperProps = {
	children: React.ReactNode;
	title: string;
	description: string;
};

export function FormWrapperComponent({
	children,
	title,
	description,
}: FormWrapperProps) {
	return (
		<div className="min-h-[calc(80vh-4rem)] flex items-center justify-center px-4 py-12">
			<div className="w-full max-w-md">
				<div className="text-center mb-8">
					<h1 className="text-2xl font-bold mb-2">{title}</h1>
					<p className="text-muted">{description}</p>
				</div>

				<div className="bg-surface border border-border rounded-xl p-6 shadow-xl">
					{children}
				</div>
			</div>
		</div>
	);
}
