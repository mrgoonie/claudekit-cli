/**
 * Model distribution bar — proportional flex segments showing Opus/Sonnet/Haiku/Unset
 */
import type { DashboardStats } from "../../hooks/use-dashboard-data";

interface ModelDistributionBarProps {
	distribution: DashboardStats["modelDistribution"];
	title: string;
	acrossAgents: string;
	total: number;
}

const MODEL_STYLES = {
	opus: {
		color: "hsl(217 91% 60%)",
		label: "Opus",
	},
	sonnet: {
		color: "hsl(16 68% 54%)",
		label: "Sonnet",
	},
	haiku: {
		color: "var(--color-warning, hsl(38 92% 50%))",
		label: "Haiku",
	},
	unset: {
		color: "var(--dash-text-disabled, hsl(0 0% 50%))",
		label: "Unset",
	},
} as const;

type ModelTier = keyof typeof MODEL_STYLES;

export function DashboardModelDistributionBar({
	distribution,
	title,
	acrossAgents,
	total,
}: ModelDistributionBarProps) {
	const tiers = (["opus", "sonnet", "haiku", "unset"] as ModelTier[]).filter(
		(tier) => distribution[tier] > 0,
	);

	return (
		<div className="bg-dash-surface border border-dash-border rounded-xl p-5 shadow-sm">
			<div className="flex items-center justify-between mb-3">
				<h3 className="text-sm font-bold text-dash-text-secondary uppercase tracking-widest">
					{title}
				</h3>
				{total > 0 && <span className="text-[10px] text-dash-text-muted">{acrossAgents}</span>}
			</div>

			{total === 0 ? (
				<div className="h-2.5 rounded-full bg-dash-border/40" />
			) : (
				<div className="flex gap-0.5 h-2.5 rounded-full overflow-hidden">
					{tiers.map((tier) => (
						<div
							key={tier}
							title={`${MODEL_STYLES[tier].label}: ${distribution[tier]}`}
							style={{
								flex: distribution[tier],
								backgroundColor: MODEL_STYLES[tier].color,
								opacity: 0.85,
							}}
						/>
					))}
				</div>
			)}

			<div className="flex flex-wrap gap-3 mt-3">
				{(["opus", "sonnet", "haiku", "unset"] as ModelTier[]).map((tier) => (
					<div key={tier} className="flex items-center gap-1.5">
						<span
							className="w-2 h-2 rounded-full shrink-0"
							style={{ backgroundColor: MODEL_STYLES[tier].color, opacity: 0.85 }}
						/>
						<span className="text-[11px] text-dash-text-muted">{MODEL_STYLES[tier].label}</span>
						<span className="text-[11px] font-bold text-dash-text font-mono">
							{distribution[tier]}
						</span>
					</div>
				))}
			</div>
		</div>
	);
}
