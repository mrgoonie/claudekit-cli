import type React from "react";
import { useSessions, useSkills } from "../hooks";
import { useI18n } from "../i18n";
import { HealthStatus, type Project } from "../types";

interface ProjectDashboardProps {
	project: Project;
}

const ProjectDashboard: React.FC<ProjectDashboardProps> = ({ project }) => {
	const { t } = useI18n();
	const { skills, loading: skillsLoading } = useSkills();
	const { sessions, loading: sessionsLoading } = useSessions(project.id);

	// Filter skills that are assigned to this project
	const projectSkills = skills.filter((s) => project.skills.includes(s.id));

	return (
		<div className="animate-in fade-in slide-in-from-bottom-2 duration-500 transition-colors">
			{/* Project Header Section */}
			<section className="mb-8">
				<div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
					<div>
						<div className="flex items-center gap-3 mb-1">
							<h1 className="text-3xl font-bold tracking-tight text-dash-text">{project.name}</h1>
							<HealthBadge status={project.health} />
						</div>
						<p className="text-dash-text-secondary mono text-sm flex items-center gap-2 italic">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								className="w-4 h-4"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
								/>
							</svg>
							{project.path}
						</p>
					</div>
					<div className="flex items-center gap-2">
						<span className="text-[10px] text-dash-text-muted font-bold uppercase tracking-widest bg-dash-surface border border-dash-border px-2 py-1 rounded">
							{sessions.length > 0 ? `${sessions.length} ${t("sessions")}` : t("noSessions")}
						</span>
					</div>
				</div>
			</section>

			{/* Quick Actions Bar */}
			<section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
				<ActionButton icon="📟" label={t("terminal")} sub={t("terminalSub")} />
				<ActionButton icon="💻" label={t("editor")} sub={t("editorSub")} />
				<ActionButton icon="🤖" label={t("launch")} sub={t("launchSub")} highlight />
				<ActionButton icon="⚙️" label={t("config")} sub={t("configSub")} />
			</section>

			{/* Main Grid Content */}
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
				{/* Left/Main Column */}
				<div className="lg:col-span-2 space-y-8">
					{/* Recent Sessions */}
					<div className="bg-dash-surface border border-dash-border rounded-xl overflow-hidden shadow-sm">
						<div className="p-6 border-b border-dash-border flex items-center justify-between bg-dash-surface-hover/50">
							<h3 className="text-sm font-bold text-dash-text-secondary uppercase tracking-widest">
								{t("recentSessions")}
							</h3>
							<button className="text-xs text-dash-text-muted hover:text-dash-text-secondary transition-colors">
								{t("viewAllHistory")}
							</button>
						</div>
						<div className="divide-y divide-dash-border">
							{sessionsLoading ? (
								<div className="p-4 text-center text-dash-text-muted animate-pulse">
									{t("loadingSessions")}
								</div>
							) : sessions.length === 0 ? (
								<div className="p-4 text-center text-dash-text-muted">{t("noSessionsFound")}</div>
							) : (
								sessions.map((session) => (
									<div
										key={session.id}
										className="p-4 hover:bg-dash-surface-hover transition-colors group cursor-pointer"
									>
										<div className="flex items-center justify-between mb-1">
											<span className="text-xs font-bold text-dash-accent">
												{session.timestamp}
											</span>
											<span className="text-[10px] text-dash-text-muted font-medium group-hover:text-dash-text-secondary transition-colors">
												{session.duration}
											</span>
										</div>
										<p className="text-sm text-dash-text-secondary leading-relaxed truncate">
											{session.summary}
										</p>
									</div>
								))
							)}
						</div>
					</div>
				</div>

				{/* Right Sidebar Column */}
				<div className="space-y-8">
					{/* Config Summary */}
					<div className="bg-dash-surface border border-dash-border rounded-xl p-6 shadow-sm">
						<h3 className="text-sm font-bold text-dash-text-secondary uppercase tracking-widest mb-4">
							{t("configuration")}
						</h3>
						<div className="space-y-4">
							<ConfigRow label={t("activeKit")} value={project.kitType} />
							<ConfigRow label={t("aiModel")} value={project.model} />
							<ConfigRow label={t("hooks")} value={`${project.activeHooks} ${t("active")}`} />
							<ConfigRow
								label={t("mcpServers")}
								value={`${project.mcpServers} ${t("connected")}`}
							/>
						</div>
						<button className="w-full mt-6 py-2 rounded-lg bg-dash-bg text-xs font-bold text-dash-text-secondary hover:bg-dash-surface-hover transition-colors border border-dash-border">
							{t("editProjectConfig")}
						</button>
					</div>

					{/* Skills List - Limited to 5 items for better UX */}
					<div className="bg-dash-surface border border-dash-border rounded-xl p-6 shadow-sm">
						<h3 className="text-sm font-bold text-dash-text-secondary uppercase tracking-widest mb-4 flex items-center justify-between">
							{t("globalSkills")}
							<span className="text-[10px] bg-dash-accent-subtle text-dash-accent px-1.5 py-0.5 rounded-full">
								{skillsLoading ? "..." : skills.length}
							</span>
						</h3>
						<div className="space-y-3">
							{skillsLoading ? (
								<div className="text-center text-dash-text-muted animate-pulse">
									{t("loadingSkills")}
								</div>
							) : (
								// Always show max 5 skills for clean UX
								(projectSkills.length > 0 ? projectSkills : skills).slice(0, 5).map((skill) => (
									<div
										key={skill.id}
										className="flex flex-col gap-0.5 border-l-2 border-dash-accent/20 pl-3 py-1"
									>
										<span className="text-sm font-semibold text-dash-text">{skill.name}</span>
										<p className="text-[10px] text-dash-text-muted leading-tight line-clamp-1">
											{skill.description || t("noDescription")}
										</p>
									</div>
								))
							)}
							{!skillsLoading && skills.length > 5 && (
								<p className="text-[10px] text-dash-text-muted text-center pt-2">
									+{skills.length - 5} more skills
								</p>
							)}
							<a
								href="https://kits.vibery.app/"
								target="_blank"
								rel="noopener noreferrer"
								className="w-full mt-2 text-xs font-bold text-dash-text-muted hover:text-dash-accent transition-colors border-t border-dash-border pt-3 text-center block"
							>
								{t("browseSkillsMarketplace")} →
							</a>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

const HealthBadge: React.FC<{ status: HealthStatus }> = ({ status }) => {
	const styles = {
		[HealthStatus.HEALTHY]: "bg-dash-accent-subtle text-dash-accent border-dash-accent/20",
		[HealthStatus.WARNING]: "bg-orange-500/10 text-orange-600 border-orange-500/20",
		[HealthStatus.ERROR]: "bg-red-500/10 text-red-600 border-red-500/20",
		[HealthStatus.LOADING]: "bg-dash-border/20 text-dash-text-muted border-dash-border",
		[HealthStatus.UNKNOWN]: "bg-dash-border/20 text-dash-text-muted border-dash-border",
	};

	return (
		<span
			className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-widest ${styles[status]}`}
		>
			{status}
		</span>
	);
};

const ActionButton: React.FC<{ icon: string; label: string; sub: string; highlight?: boolean }> = ({
	icon,
	label,
	sub,
	highlight,
}) => (
	<button
		className={`p-4 rounded-xl border flex flex-col gap-1 transition-all group ${
			highlight
				? "bg-dash-accent-subtle border-dash-accent/30 hover:bg-dash-accent-glow hover:border-dash-accent/50 shadow-sm shadow-dash-accent/5"
				: "bg-dash-surface border-dash-border hover:bg-dash-surface-hover hover:border-dash-text-muted shadow-sm"
		}`}
	>
		<span className="text-2xl mb-1 group-hover:scale-110 transition-transform">{icon}</span>
		<span className="text-sm font-bold text-dash-text">{label}</span>
		<span className="text-[10px] text-dash-text-muted font-medium truncate italic">{sub}</span>
	</button>
);

const ConfigRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
	<div className="flex items-center justify-between text-xs py-1.5 border-b border-dash-border/50 last:border-0">
		<span className="text-dash-text-muted font-medium">{label}</span>
		<span className="text-dash-text font-bold mono uppercase text-[10px] tracking-tight">
			{value}
		</span>
	</div>
);

export default ProjectDashboard;
