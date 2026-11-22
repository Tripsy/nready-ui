import { Configuration } from '@/config/settings.config';

export function LogoComponent() {
	return (
		<div className="flex px-3 py-1 items-center justify-center rounded-xl bg-accent">
			<span className="text-2xl font-bold text-accent-foreground">
				NReady
				{/* Preflight lifts a `sup` by 0.5em of its own font, which at this size leaves it
				    mid-height beside the 2xl wordmark; the offset puts it level with the cap tops */}
				<sup className="relative -top-3 ml-0.5 text-[0.65rem] font-medium opacity-70">
					{Configuration.get('app.version')}
				</sup>
			</span>
		</div>
	);
}
