/**
 * SessionProjectPage — Level 2: list all sessions for one project.
 * Route: /sessions/:projectId
 * Read-only. No write/delete/export operations.
 */
import type React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useProjectSessionList } from "../hooks/use-sessions";
import { useI18n } from "../i18n";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Decode base64url string using browser-native atob */
function decodeBase64Url(b64url: string): string {
	const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
	const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "=");
	return atob(padded);
}

/** Decode project ID to display name (dash-encoded path → last segment) */
function projectNameFromId(projectId: string): string {
	try {
		// discovered-{base64url}
		if (projectId.startsWith("discovered-")) {
			const path = decodeBase64Url(projectId.slice("discovered-".length));
			return path.split("/").filter(Boolean).pop() ?? projectId;
		}
		// dash-encoded directory name: "-home-kai-project"
		const decoded = projectId.replace(/^-/, "/").replace(/-/g, "/");
		return decoded.split("/").filter(Boolean).pop() ?? projectId;
	} catch {
		return projectId;
	}
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SessionRow({
	session,
	onClick,
}: {
	session: { id: string; timestamp: string; duration: string; summary: string };
	onClick: () => void;
}) {
	const { t } = useI18n();
	return (
		<button
			type="button"
			onClick={onClick}
			className="w-full flex items-start gap-3 p-3 rounded-lg bg-dash-surface border border-dash-border hover:bg-dash-surface-hover hover:border-dash-accent/30 transition-colors text-left"
		>
			{/* Clock icon */}
			<div className="w-8 h-8 rounded-full bg-dash-surface-hover border border-dash-border flex items-center justify-center shrink-0 mt-0.5">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					className="w-4 h-4 text-dash-text-muted"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
			</div>

			{/* Summary + meta */}
			<div className="flex-1 min-w-0">
				<p className="text-sm text-dash-text line-clamp-2">{session.summary}</p>
				<div className="flex items-center gap-2 mt-1">
					<span className="text-[10px] text-dash-text-muted">{session.timestamp}</span>
					{session.duration && session.duration !== "0min" && (
						<>
							<span className="text-[10px] text-dash-text-muted">·</span>
							<span className="text-[10px] text-dash-text-muted">
								{t("sessionDuration")}: {session.duration}
							</span>
						</>
					)}
				</div>
			</div>

			{/* Chevron */}
			<svg
				xmlns="http://www.w3.org/2000/svg"
				className="w-4 h-4 text-dash-text-muted shrink-0 mt-1"
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

const SessionProjectPage: React.FC = () => {
	const { t } = useI18n();
	const navigate = useNavigate();
	const { projectId } = useParams<{ projectId: string }>();
	const { sessions, loading, error } = useProjectSessionList(projectId);

	const projectName = projectId ? projectNameFromId(decodeURIComponent(projectId)) : "";

	return (
		<div className="flex flex-col h-full p-6 gap-4 max-w-3xl mx-auto w-full">
			{/* Header */}
			<div className="flex items-center gap-3">
				<button
					type="button"
					onClick={() => navigate("/sessions")}
					className="w-8 h-8 rounded-lg flex items-center justify-center text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text transition-colors shrink-0"
					aria-label={t("sessionBack")}
				>
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
							d="M15 19l-7-7 7-7"
						/>
					</svg>
				</button>
				<div className="flex-1 min-w-0">
					<h1 className="text-xl font-bold text-dash-text truncate">{projectName}</h1>
					<p className="text-xs text-dash-text-muted">{t("sessionProjectSessions")}</p>
				</div>
				<span className="text-xs px-2 py-0.5 rounded bg-dash-accent-subtle text-dash-accent font-semibold shrink-0">
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
			{!loading && !error && sessions.length === 0 && (
				<div className="flex flex-1 items-center justify-center text-dash-text-muted text-sm">
					{t("noSessionsData")}
				</div>
			)}

			{/* Session list */}
			{!loading && !error && sessions.length > 0 && (
				<div className="flex flex-col gap-2">
					{sessions.map((session) => (
						<SessionRow
							key={session.id}
							session={session}
							onClick={() =>
								navigate(
									`/sessions/${encodeURIComponent(projectId ?? "")}/${encodeURIComponent(session.id)}`,
								)
							}
						/>
					))}
				</div>
			)}
		</div>
	);
};

export default SessionProjectPage;
