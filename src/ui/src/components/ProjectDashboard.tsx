import type { ConfigData, Project } from "@/types";

interface ProjectDashboardProps {
	project: Project;
	config: ConfigData | null;
}

export default function ProjectDashboard({ project, config }: ProjectDashboardProps) {
	return (
		<div className="space-y-6">
			{/* Project Header */}
			<div className="bg-dash-surface rounded-lg border border-dash-border p-6">
				<div className="flex items-start justify-between">
					<div>
						<h2 className="text-xl font-semibold">{project.name}</h2>
						<p className="text-sm text-dash-text-muted mt-1">{project.path}</p>
					</div>
					<div className="flex items-center gap-2">
						{project.kitType && (
							<span className="px-2 py-1 text-xs rounded bg-dash-accent/20 text-dash-accent">
								{project.kitType}
							</span>
						)}
						{project.version && (
							<span className="px-2 py-1 text-xs rounded bg-dash-surface-hover text-dash-text-secondary">
								v{project.version}
							</span>
						)}
					</div>
				</div>
			</div>

			{/* Stats Grid */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				<div className="bg-dash-surface rounded-lg border border-dash-border p-4">
					<p className="text-sm text-dash-text-muted">Local Config</p>
					<p className="text-lg font-semibold mt-1">
						{project.hasLocalConfig ? "✓ Present" : "✗ Not Found"}
					</p>
				</div>

				<div className="bg-dash-surface rounded-lg border border-dash-border p-4">
					<p className="text-sm text-dash-text-muted">Global Config Keys</p>
					<p className="text-lg font-semibold mt-1">
						{config ? Object.keys(config.global).length : 0}
					</p>
				</div>

				<div className="bg-dash-surface rounded-lg border border-dash-border p-4">
					<p className="text-sm text-dash-text-muted">Merged Config Keys</p>
					<p className="text-lg font-semibold mt-1">
						{config ? Object.keys(config.merged).length : 0}
					</p>
				</div>
			</div>

			{/* Config Preview */}
			<div className="bg-dash-surface rounded-lg border border-dash-border">
				<div className="px-4 py-3 border-b border-dash-border">
					<h3 className="font-medium">Current Configuration</h3>
				</div>
				<div className="p-4">
					<pre className="text-sm font-mono text-dash-text-secondary bg-dash-bg p-4 rounded overflow-x-auto">
						{config ? JSON.stringify(config.merged, null, 2) : "Loading..."}
					</pre>
				</div>
			</div>
		</div>
	);
}
