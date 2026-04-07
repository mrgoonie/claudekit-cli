/**
 * Animated stat card for dashboard — shows entity count with easeOutCubic counter
 */
import { useEffect, useState } from "react";

function useAnimatedCounter(target: number, duration = 600): number {
	const [value, setValue] = useState(0);
	useEffect(() => {
		if (target === 0) {
			setValue(0);
			return;
		}
		const start = performance.now();
		let rafId: number;
		const tick = (now: number) => {
			const progress = Math.min((now - start) / duration, 1);
			const eased = 1 - (1 - progress) ** 3;
			setValue(Math.round(eased * target));
			if (progress < 1) {
				rafId = requestAnimationFrame(tick);
			}
		};
		rafId = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(rafId);
	}, [target, duration]);
	return value;
}

interface DashboardStatCardProps {
	label: string;
	sublabel: string;
	value: number;
	icon: string;
}

export function DashboardStatCard({ label, sublabel, value, icon }: DashboardStatCardProps) {
	const displayValue = useAnimatedCounter(value);

	return (
		<div className="bg-dash-surface border border-dash-border rounded-xl p-5 flex flex-col gap-2 shadow-sm hover:border-dash-text-muted transition-colors">
			<div className="flex items-center justify-between">
				<span className="text-xl">{icon}</span>
				<span className="text-[10px] font-bold uppercase tracking-widest text-dash-text-muted">
					{sublabel}
				</span>
			</div>
			<span className="text-[2rem] font-bold font-mono text-dash-text leading-none">
				{displayValue}
			</span>
			<span className="text-xs text-dash-text-secondary font-medium">{label}</span>
		</div>
	);
}
