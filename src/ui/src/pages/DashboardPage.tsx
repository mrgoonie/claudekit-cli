/**
 * Home dashboard page — entity stats, model distribution, recent agents, suggestions
 * Route: / (index) and /dashboard
 */
import type React from "react";
import { DashboardModelDistributionBar } from "../components/dashboard/dashboard-model-distribution-bar";
import { DashboardRecentAgents } from "../components/dashboard/dashboard-recent-agents";
import { DashboardStatCard } from "../components/dashboard/dashboard-stat-card";
import { DashboardSuggestionsPanel } from "../components/dashboard/dashboard-suggestions-panel";
import { useDashboardData } from "../hooks/use-dashboard-data";
import { useI18n } from "../i18n";

const DashboardPage: React.FC = () => {
	const { t } = useI18n();
	const { stats, agents, suggestions, loading, error } = useDashboardData();

	const safeStats = stats ?? {
		agents: 0,
		commands: 0,
		skills: 0,
		mcpServers: 0,
		modelDistribution: { opus: 0, sonnet: 0, haiku: 0, unset: 0 },
	};

	const totalAgents = safeStats.agents;
	const acrossAgentsText = t("acrossAgents").replace("{count}", String(totalAgents));

	return (
		<div className="animate-in fade-in slide-in-from-bottom-2 duration-500 flex flex-col gap-6 h-full">
			{/* Page title */}
			<div className="shrink-0">
				<h1 className="text-2xl font-bold tracking-tight text-dash-text">{t("dashboardTitle")}</h1>
			</div>

			{/* Error banner */}
			{error && (
				<div className="shrink-0 rounded-lg border border-orange-500/30 bg-orange-500/5 px-3 py-2 text-xs text-orange-700 dark:text-orange-300">
					{error}
				</div>
			)}

			{/* Stat cards — 4-col responsive grid */}
			<section className="shrink-0 grid grid-cols-2 md:grid-cols-4 gap-3">
				<DashboardStatCard
					label={t("dashboardAgents")}
					sublabel={t("configured")}
					value={safeStats.agents}
					icon="🤖"
				/>
				<DashboardStatCard
					label={t("dashboardCommands")}
					sublabel={t("available")}
					value={safeStats.commands}
					icon="⚡"
				/>
				<DashboardStatCard
					label={t("dashboardSkills")}
					sublabel={t("installed")}
					value={safeStats.skills}
					icon="🧩"
				/>
				<DashboardStatCard
					label={t("dashboardMcpServers")}
					sublabel={t("connected")}
					value={safeStats.mcpServers}
					icon="🔌"
				/>
			</section>

			{/* Model distribution */}
			<section className="shrink-0">
				{loading ? (
					<div className="bg-dash-surface border border-dash-border rounded-xl p-5 h-20 animate-pulse" />
				) : (
					<DashboardModelDistributionBar
						distribution={safeStats.modelDistribution}
						title={t("modelDistribution")}
						acrossAgents={acrossAgentsText}
						total={totalAgents}
					/>
				)}
			</section>

			{/* Bottom section: recent agents + suggestions */}
			<section className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-4">
				<div className="lg:col-span-2 min-h-0">
					{loading ? (
						<div className="bg-dash-surface border border-dash-border rounded-xl h-full animate-pulse" />
					) : (
						<DashboardRecentAgents
							agents={agents}
							title={t("recentAgents")}
							noAgentsMessage={t("noAgentsConfigured")}
						/>
					)}
				</div>
				<div className="min-h-0">
					{loading ? (
						<div className="bg-dash-surface border border-dash-border rounded-xl h-full animate-pulse" />
					) : (
						<DashboardSuggestionsPanel suggestions={suggestions} title={t("suggestionsTitle")} />
					)}
				</div>
			</section>
		</div>
	);
};

export default DashboardPage;
