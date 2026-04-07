/**
 * SessionsPage — Level 1: list all projects that have session data.
 * Route: /sessions
 * Read-only. No write/delete/export operations.
 */
import type React from "react";
import { useNavigate } from "react-router-dom";
import { useSessionProjects } from "../hooks/use-sessions";
import type { SessionProject } from "../hooks/use-sessions";
import { useI18n } from "../i18n";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(isoString: string): string {
	const date = new Date(isoString);
	if (Number.isNaN(date.getTime())) return "";
	const diffMs = Date.now() - date.getTime();
	const diffMin = Math.floor(diffMs / 60000);
	if (diffMin < 1) return "just now";
	if (diffMin < 60) return `${diffMin}m ago`;
	const diffHr = Math.floor(diffMin / 60);
	if (diffHr < 24) return `${diffHr}h ago`;
	const diffDays = Math.floor(diffHr / 24);
	if (diffDays < 30) return `${diffDays}d ago`;
	return date.toLocaleDateString();
}

function projectInitial(name: string): string {
	return (name[0] ?? "?").toUpperCase();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProjectRow({
	project,
	onClick,
}: {
	project: SessionProject;
	onClick: () => void;
}) {
	const { t } = useI18n();
	return (
		<button
			type="button"
			onClick={onClick}
			className="w-full flex items-center gap-3 p-3 rounded-lg bg-dash-surface border border-dash-border hover:bg-dash-surface-hover hover:border-dash-accent/30 transition-colors text-left"
		>
			{/* Avatar */}
			<div className="w-9 h-9 rounded-full bg-dash-accent-subtle text-dash-accent flex items-center justify-center text-sm font-bold shrink-0">
				{projectInitial(project.name)}
			</div>

			{/* Name + path */}
			<div className="flex-1 min-w-0">
				<p className="text-sm font-semibold text-dash-text truncate">{project.name}</p>
				<p className="text-xs text-dash-text-muted truncate">{project.path}</p>
			</div>

			{/* Count + time */}
			<div className="flex flex-col items-end shrink-0 gap-0.5">
				<span className="text-xs font-semibold text-dash-text">
					{project.sessionCount} {t("sessionCount")}
				</span>
				<span className="text-[10px] text-dash-text-muted">
					{t("sessionLastActive")} {formatRelativeTime(project.lastActive)}
				</span>
			</div>

			{/* Chevron */}
			<svg
				xmlns="http://www.w3.org/2000/svg"
				className="w-4 h-4 text-dash-text-muted shrink-0"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
			</svg>
		</button>
	);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const SessionsPage: React.FC = () => {
	const { t } = useI18n();
	const navigate = useNavigate();
	const { projects, loading, error } = useSessionProjects();

	return (
		<div className="flex flex-col h-full p-6 gap-4 max-w-3xl mx-auto w-full">
			{/* Header */}
			<div className="flex items-center justify-between">
				<h1 className="text-xl font-bold text-dash-text">{t("sessionsTitle")}</h1>
				<span className="text-xs px-2 py-0.5 rounded bg-dash-accent-subtle text-dash-accent font-semibold">
					{t("sessionReadOnly")}
				</span>
			</div>

			{/* Loading */}
			{loading && (
				<div className="flex flex-1 items-center justify-center text-dash-text-muted text-sm">
					{t("sessionLoading")}
				</div>
			)}

			{/* Error */}
			{!loading && error && (
				<div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-900/20 p-4 text-red-600 dark:text-red-400 text-sm">
					{t("sessionError")}: {error}
				</div>
			)}

			{/* Empty */}
			{!loading && !error && projects.length === 0 && (
				<div className="flex flex-1 items-center justify-center text-dash-text-muted text-sm">
					{t("noSessionsData")}
				</div>
			)}

			{/* Project list */}
			{!loading && !error && projects.length > 0 && (
				<div className="flex flex-col gap-2">
					{projects.map((project) => (
						<ProjectRow
							key={project.id}
							project={project}
							onClick={() => navigate(`/sessions/${encodeURIComponent(project.id)}`)}
						/>
					))}
				</div>
			)}
		</div>
	);
};

export default SessionsPage;
