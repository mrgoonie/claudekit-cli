/**
 * Skills Browser page — split-panel layout: skill cards on left, SKILL.md detail on right.
 * Route: /skills
 * Detail inlined from SkillDetailPage (removed separate route).
 */
import type React from "react";
import { useMemo, useState } from "react";
import ResizeHandle from "../components/ResizeHandle";
import MarkdownRenderer from "../components/markdown-renderer";
import type { SkillBrowserItem } from "../hooks/use-skills-browser";
import { useSkillDetail, useSkillsBrowser } from "../hooks/use-skills-browser";
import { useResizable } from "../hooks/useResizable";
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

// ── Skill card (left panel) ──────────────────────────────────────────────────

function SkillCard({
	skill,
	selected,
	onClick,
}: {
	skill: SkillBrowserItem;
	selected: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={[
				"w-full flex flex-col gap-2 p-4 rounded-xl border text-left transition-colors",
				selected
					? "bg-[var(--dash-accent)]/8 border-[var(--dash-accent)]/40"
					: "bg-[var(--card)] border-[var(--dash-border)] hover:border-[var(--dash-accent)]/40",
			].join(" ")}
		>
			{/* Header row: name + installed badge */}
			<div className="flex items-start justify-between gap-2">
				<h3
					className={[
						"text-sm font-semibold font-mono leading-snug break-all transition-colors",
						selected
							? "text-[var(--dash-accent)]"
							: "text-[var(--dash-text)] group-hover:text-[var(--dash-accent)]",
					].join(" ")}
				>
					{skill.name}
				</h3>
				<InstalledBadge installed={skill.installed} />
			</div>

			{/* Description */}
			{skill.description ? (
				<p className="text-xs text-[var(--dash-text-muted)] leading-relaxed line-clamp-2">
					{skill.description}
				</p>
			) : (
				<p className="text-xs text-[var(--dash-text-muted)] italic">No description</p>
			)}

			{/* Footer: source + triggers */}
			<div className="flex flex-col gap-1.5 mt-auto">
				<SourceBadge source={skill.source} />

				{skill.triggers && skill.triggers.length > 0 && (
					<div className="flex flex-wrap gap-1">
						{skill.triggers.slice(0, 3).map((trigger) => (
							<span
								key={trigger}
								className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--dash-surface-hover)] text-[var(--dash-text-muted)] border border-[var(--dash-border)]"
							>
								{trigger}
							</span>
						))}
						{skill.triggers.length > 3 && (
							<span className="text-[10px] text-[var(--dash-text-muted)]">
								+{skill.triggers.length - 3}
							</span>
						)}
					</div>
				)}
			</div>
		</button>
	);
}

// ── Skill detail panel (right panel) ─────────────────────────────────────────

const SkillDetailPanel: React.FC<{ name: string }> = ({ name }) => {
	const { t } = useI18n();
	const { detail, loading, error, reload } = useSkillDetail(name);

	if (loading) {
		return (
			<div className="flex items-center justify-center h-32">
				<div className="text-center">
					<div className="w-6 h-6 border-4 border-[var(--dash-accent)] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
					<p className="text-[var(--dash-text-muted)] text-sm">{t("loadingSkills")}</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex items-center justify-center h-32">
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

	if (!detail) return null;

	return (
		<div className="flex flex-col gap-5">
			{/* Header */}
			<div className="flex items-start justify-between gap-4">
				<div className="flex-1 min-w-0">
					<h2 className="text-lg font-bold text-[var(--dash-text)] font-mono break-all">
						{detail.name}
					</h2>
					{detail.description && (
						<p className="text-sm text-[var(--dash-text-muted)] mt-1">{detail.description}</p>
					)}
				</div>

				{/* Meta badges */}
				<div className="flex flex-col items-end gap-2 shrink-0">
					<InstalledBadge installed={detail.installed} />
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
				<div className="flex items-center gap-2">
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

			{/* Read-only notice */}
			<div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--dash-surface)] border border-[var(--dash-border)] text-xs text-[var(--dash-text-muted)]">
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

			{/* SKILL.md content */}
			<MarkdownRenderer content={detail.content} />
		</div>
	);
};

// ── Empty placeholder ─────────────────────────────────────────────────────────

const EmptyDetailPlaceholder: React.FC<{ message: string }> = ({ message }) => (
	<div className="flex items-center justify-center h-full text-sm text-[var(--dash-text-muted)]">
		{message}
	</div>
);

// ── Main page ────────────────────────────────────────────────────────────────

const SkillsBrowserPage: React.FC = () => {
	const { t } = useI18n();
	const { skills, loading, error, reload } = useSkillsBrowser();
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedName, setSelectedName] = useState<string | null>(null);

	const { size, isDragging, startDrag } = useResizable({
		storageKey: "ck-skills-panel-width",
		defaultSize: 400,
		minSize: 260,
		maxSize: 700,
	});

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
		<div className="flex h-full overflow-hidden">
			{/* Left panel: card list */}
			<div
				style={{ width: `${size}px` }}
				className="shrink-0 flex flex-col overflow-hidden border-r border-[var(--dash-border)]"
			>
				{/* Header */}
				<div className="shrink-0 border-b border-[var(--dash-border)] bg-[var(--dash-surface)] px-4 py-4">
					<h1 className="text-base font-bold text-[var(--dash-text)]">{t("skillsBrowser")}</h1>
					<p className="text-xs text-[var(--dash-text-muted)] mt-0.5">
						{t("skillsCount").replace("{count}", String(skills.length))}
					</p>
					<p className="text-[11px] text-[var(--dash-text-muted)] font-mono mt-0.5">
						~/.claude/skills/
					</p>
				</div>

				{/* Search toolbar */}
				<div className="shrink-0 border-b border-[var(--dash-border)] bg-[var(--dash-surface)] px-4 py-3">
					<div className="relative">
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
				<div className="flex-1 overflow-y-auto px-4 py-4">
					{filtered.length === 0 ? (
						<div className="text-center py-8">
							<p className="text-[var(--dash-text-muted)] text-sm">{t("noSkillsBrowserFound")}</p>
						</div>
					) : (
						<div className="flex flex-col gap-2">
							{filtered.map((skill) => (
								<SkillCard
									key={skill.name}
									skill={skill}
									selected={selectedName === skill.name}
									onClick={() => setSelectedName(skill.name)}
								/>
							))}
						</div>
					)}
				</div>
			</div>

			{/* Resize handle */}
			<ResizeHandle onMouseDown={startDrag} isDragging={isDragging} direction="horizontal" />

			{/* Right panel: detail */}
			<div className="flex-1 overflow-y-auto p-6">
				{selectedName ? (
					<SkillDetailPanel name={selectedName} />
				) : (
					<EmptyDetailPlaceholder message={t("selectToView")} />
				)}
			</div>
		</div>
	);
};

export default SkillsBrowserPage;
