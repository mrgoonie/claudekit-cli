import { useProject } from "@/contexts/ProjectContext";
import { useConfig } from "@/hooks/useConfig";
import { QuickActions } from "./QuickActions";
import { ConfigSummary } from "./ConfigSummary";
import { HealthBadge } from "./HealthBadge";
import { SkillsPanel } from "../skills/SkillsPanel";
import { SessionsPanel } from "../sessions/SessionsPanel";
import { useHealth } from "./hooks/useHealth";

export function DashboardPage() {
	const { currentProject } = useProject();
	const { config, loading: configLoading } = useConfig();
	const { health } = useHealth(currentProject?.id ?? null);

	if (!currentProject) {
		return (
			<div className="flex items-center justify-center h-full text-muted-foreground">
				Select a project from the sidebar to get started
			</div>
		);
	}

	// Derive health status and issue count
	const healthStatus = health?.status ?? "healthy";
	const issueCount = health?.configIssues?.length ?? 0;

	return (
		<div className="space-y-6">
			{/* Project Header */}
			<div className="space-y-2">
				<div className="flex items-center gap-4">
					<h1 className="text-2xl font-bold">{currentProject.name}</h1>
					<HealthBadge status={healthStatus} issueCount={issueCount} />
				</div>
				<p className="text-sm text-muted-foreground font-mono">
					{currentProject.path}
				</p>
			</div>

			{/* Quick Actions */}
			<QuickActions projectPath={currentProject.path} />

			{/* Main Grid */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
				{configLoading ? (
					<div className="text-muted-foreground text-sm">Loading config...</div>
				) : (
					<ConfigSummary config={config?.merged ?? {}} />
				)}
				<SkillsPanel />
			</div>

			{/* Sessions */}
			<SessionsPanel />
		</div>
	);
}
