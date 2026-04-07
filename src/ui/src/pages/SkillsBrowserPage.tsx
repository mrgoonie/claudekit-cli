/**
 * Skills Browser page — card grid of locally-installed skills with search.
 * Route: /skills (replaces redirect to /migrate from Phase 1 sidebar addition)
 * Distinct from SkillsPage.tsx (marketplace/install page at a different route).
 */
import type React from "react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { SkillBrowserItem } from "../hooks/use-skills-browser";
import { useSkillsBrowser } from "../hooks/use-skills-browser";
import { useI18n } from "../i18n";

// ── Badge components ────────────────────────────────────────────────────────

function InstalledBadge({ installed }: { installed: boolean }) {
	if (installed) {
		return (
			<span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-500/15 text-green-500 border border-green-500/30">
				Installed
			</span>
		);
	}
	return (
		<span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/15 text-red-500 border border-red-500/30">
			Not Found
		</span>
	);
}

function SourceBadge({ source }: { source: "local" | "github" }) {
	if (source === "github") {
		return (
			<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
				<svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
					<path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
				</svg>
				GitHub
			</span>
		);
	}
	return (
		<span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium text-[var(--dash-text-muted)] border border-[var(--dash-border)]">
			Local
		</span>
	);
}

// ── Skill card ───────────────────────────────────────────────────────────────

function SkillCard({ skill }: { skill: SkillBrowserItem }) {
	return (
		<Link
			to={`/skills/${encodeURIComponent(skill.name)}`}
			className={[
				"flex flex-col gap-3 p-4 rounded-xl border bg-[var(--card)]",
				"border-[var(--dash-border)] hover:border-[var(--dash-accent)]",
				"transition-colors cursor-pointer group",
			].join(" ")}
		>
			{/* Header row: name + installed badge */}
			<div className="flex items-start justify-between gap-2">
				<h3 className="text-sm font-semibold text-[var(--dash-text)] group-hover:text-[var(--dash-accent)] transition-colors font-mono leading-snug break-all">
					{skill.name}
				</h3>
				<InstalledBadge installed={skill.installed} />
			</div>

			{/* Description */}
			{skill.description ? (
				<p className="text-xs text-[var(--dash-text-muted)] leading-relaxed line-clamp-2 flex-1">
					{skill.description}
				</p>
			) : (
				<p className="text-xs text-[var(--dash-text-muted)] italic flex-1">No description</p>
			)}

			{/* Footer: source + triggers */}
			<div className="flex flex-col gap-2 mt-auto">
				<SourceBadge source={skill.source} />

				{skill.triggers && skill.triggers.length > 0 && (
					<div className="flex flex-wrap gap-1">
						{skill.triggers.slice(0, 4).map((trigger) => (
							<span
								key={trigger}
								className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--dash-surface-hover)] text-[var(--dash-text-muted)] border border-[var(--dash-border)]"
							>
								{trigger}
							</span>
						))}
						{skill.triggers.length > 4 && (
							<span className="text-[10px] text-[var(--dash-text-muted)]">
								+{skill.triggers.length - 4}
							</span>
						)}
					</div>
				)}
			</div>
		</Link>
	);
}

// ── Main page ────────────────────────────────────────────────────────────────

const SkillsBrowserPage: React.FC = () => {
	const { t } = useI18n();
	const { skills, loading, error, reload } = useSkillsBrowser();
	const [searchQuery, setSearchQuery] = useState("");

	const filtered = useMemo(() => {
		if (!searchQuery.trim()) return skills;
		const q = searchQuery.toLowerCase();
		return skills.filter(
			(s) =>
				s.name.toLowerCase().includes(q) ||
				s.description?.toLowerCase().includes(q) ||
				s.triggers?.some((tr) => tr.toLowerCase().includes(q)),
		);
	}, [skills, searchQuery]);

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
					<button
						type="button"
						onClick={reload}
						className="px-4 py-2 bg-[var(--dash-accent)] text-white rounded-md text-sm hover:bg-[var(--dash-accent)]/90 transition-colors"
					>
						{t("tryAgain")}
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="h-full flex flex-col">
			{/* Header */}
			<div className="border-b border-[var(--dash-border)] bg-[var(--dash-surface)] px-8 py-5">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-xl font-bold text-[var(--dash-text)]">{t("skillsBrowser")}</h1>
						<p className="text-sm text-[var(--dash-text-muted)] mt-0.5">
							{t("skillsCount").replace("{count}", String(skills.length))}
						</p>
					</div>
				</div>
			</div>

			{/* Search toolbar */}
			<div className="border-b border-[var(--dash-border)] bg-[var(--dash-surface)] px-8 py-3">
				<div className="relative max-w-md">
					<svg
						className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 stroke-[var(--dash-text-muted)]"
						fill="none"
						viewBox="0 0 24 24"
						strokeWidth={2}
						strokeLinecap="round"
						strokeLinejoin="round"
						aria-hidden="true"
					>
						<circle cx="11" cy="11" r="8" />
						<line x1="21" y1="21" x2="16.65" y2="16.65" />
					</svg>
					<input
						type="text"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder={t("searchSkillsBrowserPlaceholder")}
						className="w-full pl-9 pr-3 py-2 bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] text-sm focus:outline-none focus:border-[var(--dash-accent)] transition-colors"
					/>
				</div>
			</div>

			{/* Grid content */}
			<div className="flex-1 overflow-y-auto px-8 py-6">
				{filtered.length === 0 ? (
					<div className="text-center py-12">
						<p className="text-[var(--dash-text-muted)] text-sm">{t("noSkillsBrowserFound")}</p>
					</div>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
						{filtered.map((skill) => (
							<SkillCard key={skill.name} skill={skill} />
						))}
					</div>
				)}
			</div>
		</div>
	);
};

export default SkillsBrowserPage;
