/**
 * Skill Detail page — read-only view of a single skill's SKILL.md content.
 * Route: /skills/:name
 */
import type React from "react";
import { Link, useParams } from "react-router-dom";
import MarkdownRenderer from "../components/markdown-renderer";
import { useSkillDetail } from "../hooks/use-skills-browser";
import { useI18n } from "../i18n";

// ── Main page ────────────────────────────────────────────────────────────────

const SkillDetailPage: React.FC = () => {
	const { name = "" } = useParams<{ name: string }>();
	const { t } = useI18n();
	const { detail, loading, error, reload } = useSkillDetail(name);

	if (loading) {
		return (
			<div className="flex items-center justify-center h-full">
				<div className="text-center">
					<div className="w-8 h-8 border-4 border-[var(--dash-accent)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
					<p className="text-[var(--dash-text-muted)] text-sm">{t("loadingSkills")}</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex items-center justify-center h-full">
				<div className="text-center max-w-sm">
					<p className="text-red-500 mb-3 text-sm">{error}</p>
					<div className="flex gap-2 justify-center">
						<Link
							to="/skills"
							className="px-4 py-2 border border-[var(--dash-border)] text-[var(--dash-text)] rounded-md text-sm hover:bg-[var(--dash-surface-hover)] transition-colors"
						>
							{t("backToSkillsBrowser")}
						</Link>
						<button
							type="button"
							onClick={reload}
							className="px-4 py-2 bg-[var(--dash-accent)] text-white rounded-md text-sm hover:bg-[var(--dash-accent)]/90 transition-colors"
						>
							{t("tryAgain")}
						</button>
					</div>
				</div>
			</div>
		);
	}

	if (!detail) return null;

	return (
		<div className="h-full flex flex-col">
			{/* Header */}
			<div className="border-b border-[var(--dash-border)] bg-[var(--dash-surface)] px-8 py-5">
				<div className="flex items-start justify-between gap-4">
					<div className="flex-1 min-w-0">
						{/* Back link */}
						<Link
							to="/skills"
							className="inline-flex items-center gap-1.5 text-xs text-[var(--dash-text-muted)] hover:text-[var(--dash-text)] transition-colors mb-2"
						>
							<svg
								className="w-3 h-3"
								fill="none"
								viewBox="0 0 24 24"
								strokeWidth={2}
								stroke="currentColor"
								aria-hidden="true"
							>
								<path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
							</svg>
							{t("backToSkillsBrowser")}
						</Link>

						<h1 className="text-xl font-bold text-[var(--dash-text)] font-mono break-all">
							{detail.name}
						</h1>

						{detail.description && (
							<p className="text-sm text-[var(--dash-text-muted)] mt-1">{detail.description}</p>
						)}
					</div>

					{/* Meta badges */}
					<div className="flex flex-col items-end gap-2 shrink-0">
						{/* Installed badge */}
						<span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-500/15 text-green-500 border border-green-500/30">
							Installed
						</span>

						{/* Source */}
						<div className="flex items-center gap-1.5 text-xs text-[var(--dash-text-muted)]">
							<span className="font-medium">{t("skillSource")}:</span>
							{detail.source === "github" ? (
								<span className="text-blue-400">GitHub</span>
							) : (
								<span>{t("skillLocal")}</span>
							)}
						</div>
					</div>
				</div>

				{/* Triggers */}
				{detail.triggers && detail.triggers.length > 0 && (
					<div className="flex items-center gap-2 mt-3">
						<span className="text-xs font-medium text-[var(--dash-text-muted)]">
							{t("skillTriggers")}:
						</span>
						<div className="flex flex-wrap gap-1">
							{detail.triggers.map((trigger) => (
								<span
									key={trigger}
									className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--dash-surface-hover)] text-[var(--dash-text-muted)] border border-[var(--dash-border)]"
								>
									{trigger}
								</span>
							))}
						</div>
					</div>
				)}
			</div>

			{/* SKILL.md content */}
			<div className="flex-1 overflow-y-auto px-8 py-6">
				<div className="max-w-3xl">
					{/* Read-only notice */}
					<div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-[var(--dash-surface)] border border-[var(--dash-border)] text-xs text-[var(--dash-text-muted)]">
						<svg
							className="w-3.5 h-3.5 shrink-0"
							fill="none"
							viewBox="0 0 24 24"
							strokeWidth={2}
							stroke="currentColor"
							aria-hidden="true"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
							/>
						</svg>
						{t("readOnly")} — SKILL.md
					</div>

					{/* Rendered markdown — shared MarkdownRenderer */}
					<MarkdownRenderer content={detail.content} />
				</div>
			</div>
		</div>
	);
};

export default SkillDetailPage;
