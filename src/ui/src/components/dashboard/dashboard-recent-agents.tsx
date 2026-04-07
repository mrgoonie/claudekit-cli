/**
 * Recent agents section — top 6 agents as mini cards with name, description, model badge
 */
import type { DashboardAgent } from "../../hooks/use-dashboard-data";

const MODEL_BADGE_STYLES: Record<string, string> = {
	opus: "bg-blue-500/10 text-blue-500 border-blue-500/20",
	sonnet: "bg-orange-500/10 text-orange-500 border-orange-500/20",
	haiku: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
	unset: "bg-dash-border/30 text-dash-text-muted border-dash-border/40",
};

function getModelBadgeStyle(model: string): string {
	const lower = model.toLowerCase();
	if (lower.includes("opus")) return MODEL_BADGE_STYLES.opus;
	if (lower.includes("sonnet")) return MODEL_BADGE_STYLES.sonnet;
	if (lower.includes("haiku")) return MODEL_BADGE_STYLES.haiku;
	return MODEL_BADGE_STYLES.unset;
}

function getModelLabel(model: string): string {
	if (!model || model === "unset") return "unset";
	// Shorten model name for badge display
	const lower = model.toLowerCase();
	if (lower.includes("opus")) return "opus";
	if (lower.includes("sonnet")) return "sonnet";
	if (lower.includes("haiku")) return "haiku";
	return model.length > 12 ? `${model.slice(0, 12)}…` : model;
}

interface DashboardRecentAgentsProps {
	agents: DashboardAgent[];
	title: string;
	noAgentsMessage: string;
}

export function DashboardRecentAgents({
	agents,
	title,
	noAgentsMessage,
}: DashboardRecentAgentsProps) {
	return (
		<div className="bg-dash-surface border border-dash-border rounded-xl shadow-sm flex flex-col min-h-0">
			<div className="px-4 py-3 border-b border-dash-border shrink-0">
				<h3 className="text-sm font-bold text-dash-text-secondary uppercase tracking-widest">
					{title}
				</h3>
			</div>
			<div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 overflow-y-auto">
				{agents.length === 0 ? (
					<div className="col-span-2 py-6 text-center text-dash-text-muted text-sm">
						{noAgentsMessage}
					</div>
				) : (
					agents.map((agent) => (
						<div
							key={agent.name}
							className="flex flex-col gap-1 p-3 rounded-lg border border-dash-border bg-dash-bg hover:bg-dash-surface-hover transition-colors"
						>
							<div className="flex items-center justify-between gap-2">
								<span className="text-sm font-semibold text-dash-text truncate">{agent.name}</span>
								<span
									className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wide ${getModelBadgeStyle(agent.model)}`}
								>
									{getModelLabel(agent.model)}
								</span>
							</div>
							<p className="text-[11px] text-dash-text-muted leading-tight line-clamp-2">
								{agent.description || "\u00a0"}
							</p>
						</div>
					))
				)}
			</div>
		</div>
	);
}
