/**
 * CommandDetailPage — read-only markdown view of a single command file.
 * Route: /commands/:slug (splat, any depth)
 */
import type React from "react";
import { useNavigate, useParams } from "react-router-dom";
import MarkdownRenderer from "../components/markdown-renderer";
import { useCommandDetail } from "../hooks/use-commands";
import { useI18n } from "../i18n";

// ─── Page ─────────────────────────────────────────────────────────────────────

const CommandDetailPage: React.FC = () => {
	const { t } = useI18n();
	const navigate = useNavigate();
	// React Router v6 splat param is "*"
	const params = useParams<{ "*": string }>();
	const commandPath = params["*"];

	const { detail, loading, error } = useCommandDetail(commandPath);

	return (
		<div className="flex flex-col h-full gap-4 max-w-3xl mx-auto w-full">
			{/* Back button + header */}
			<div className="flex items-center gap-3">
				<button
					type="button"
					onClick={() => navigate("/commands")}
					className="flex items-center gap-1.5 text-sm text-dash-text-muted hover:text-dash-text transition-colors shrink-0"
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
					{t("backToCommands")}
				</button>
				<span className="text-dash-border">/</span>
				{detail && (
					<h1 className="text-sm font-semibold text-dash-text font-mono truncate">
						/{detail.name}
					</h1>
				)}
				<span className="ml-auto text-xs px-2 py-0.5 rounded bg-dash-accent-subtle text-dash-accent font-semibold shrink-0">
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

			{/* Detail */}
			{!loading && !error && detail && (
				<div className="flex flex-col gap-4 overflow-y-auto pb-6">
					{/* Meta card */}
					{detail.description && (
						<div className="rounded-lg border border-dash-border bg-dash-surface px-4 py-3">
							<p className="text-sm text-dash-text-muted">{detail.description}</p>
						</div>
					)}

					{/* Path badge */}
					<div className="flex items-center gap-2 text-xs text-dash-text-muted">
						<span className="font-mono px-2 py-0.5 rounded bg-dash-surface border border-dash-border text-dash-accent">
							~/.claude/commands/{detail.path}
						</span>
					</div>

					{/* Markdown content — rendered via shared MarkdownRenderer (no dangerouslySetInnerHTML) */}
					<div className="rounded-lg border border-dash-border bg-dash-surface p-5 overflow-x-auto">
						<MarkdownRenderer content={detail.content} />
					</div>
				</div>
			)}
		</div>
	);
};

export default CommandDetailPage;
