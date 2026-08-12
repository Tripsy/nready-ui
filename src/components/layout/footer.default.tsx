import { Configuration } from '@/config/settings.config';

export function Footer() {
	return (
		<footer className="border-t border-border bg-surface-secondary/30">
			<div className="container-default py-8 md:py-12">
				<p className="text-sm text-muted">
					© {new Date().getFullYear()} {Configuration.get('app.name')}{' '}
					- Drive Management System. All rights reserved.
				</p>
			</div>
		</footer>
	);
}
