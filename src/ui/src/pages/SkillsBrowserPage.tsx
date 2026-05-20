/**
 * Skills Browser page — split-panel layout: flat list on left, SKILL.md detail on right.
 * Route: /skills-browser
 * Design: mirrors CommandsPage exactly (dash-* CSS vars, same item/detail patterns).
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ResizeHandle from "../components/ResizeHandle";
import MarkdownRenderer from "../components/markdown-renderer";
import type { SkillBrowserItem } from "../hooks/use-skills-browser";
import { useSkillDetail, useSkillsBrowser } from "../hooks/use-skills-browser";
import { useResizable } from "../hooks/useResizable";
import { useI18n } from "../i18n";

// ─── Icon ─────────────────────────────────────────────────────────────────────

function SkillIcon() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			className="w-3.5 h-3.5 shrink-0 text-dash-accent"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
		>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M13 10V3L4 14h7v7l9-11h-7z"
			/>
		</svg>
	);
}

// ─── Skill list item ───────────────────────────────────────────────────────────

const SkillItem = React.forwardRef<
	HTMLButtonElement,
	{
		skill: SkillBrowserItem;
		selected: boolean;
		onClick: () => void;
	}
>(({ skill, selected, onClick }, ref) => {
	return (
		<button
			ref={ref}
			type="button"
			onClick={onClick}
			className={[
				"w-full flex items-start gap-2 px-3 py-2 rounded-md transition-colors text-left group",
				selected
					? "bg-dash-accent/10 border border-dash-accent/30"
					: "hover:bg-dash-surface-hover border border-transparent",
			].join(" ")}
		>
			<SkillIcon />
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-1.5 flex-wrap">
					<span className="text-sm font-semibold text-dash-accent font-mono">{skill.name}</span>
					{skill.source === "github" && (
						<span className="text-[10px] px-1.5 py-0.5 rounded bg-dash-accent-subtle text-dash-accent font-medium shrink-0">
							GitHub
						</span>
					)}
				</div>
				{skill.description && (
					<p className="text-xs text-dash-text-muted mt-0.5 truncate">{skill.description}</p>
				)}
			</div>
		</button>
	);
});

// ─── Skill detail panel ────────────────────────────────────────────────────────

const SkillDetailPanel: React.FC<{ name: string }> = ({ name }) => {
	const { t } = useI18n();
	const { detail, loading, error } = useSkillDetail(name);

	if (loading) {
		return (
			<div className="flex items-center justify-center h-32 text-sm text-dash-text-muted">
				{t("loadingSkills")}
			</div>
		);
	}

	if (error) {
		return (
			<div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-900/20 p-4 text-red-600 dark:text-red-400 text-sm">
				{error}
			</div>
		);
	}

	if (!detail) return null;

	return (
		<div className="flex flex-col gap-4">
			{/* Title + read-only badge */}
			<div className="flex items-center gap-3">
				<h2 className="text-base font-semibold text-dash-text font-mono truncate flex-1">
					{detail.name}
				</h2>
				<span className="text-xs px-2 py-0.5 rounded bg-dash-accent-subtle text-dash-accent font-semibold shrink-0">
					{t("sessionReadOnly")}
				</span>
			</div>

			{/* Description */}
			{detail.description && (
				<div className="rounded-lg border border-dash-border bg-dash-surface px-4 py-3">
					<p className="text-sm text-dash-text-muted">{detail.description}</p>
				</div>
			)}

			{/* Path badge */}
			<div className="flex items-center gap-2 text-xs text-dash-text-muted">
				<span className="font-mono px-2 py-0.5 rounded bg-dash-surface border border-dash-border text-dash-accent">
					~/.claude/skills/{detail.name}/SKILL.md
				</span>
			</div>

			{/* Triggers */}
			{detail.triggers && detail.triggers.length > 0 && (
				<div className="flex items-center gap-2 flex-wrap">
					<span className="text-xs text-dash-text-muted">{t("skillTriggers")}:</span>
					{detail.triggers.map((trigger) => (
						<span
							key={trigger}
							className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-dash-surface border border-dash-border text-dash-accent"
						>
							{trigger}
						</span>
					))}
				</div>
			)}

			{/* SKILL.md content */}
			<div className="rounded-lg border border-dash-border bg-dash-surface p-5 overflow-x-auto">
				<MarkdownRenderer content={detail.content} />
			</div>
		</div>
	);
};

// ─── Empty placeholder ─────────────────────────────────────────────────────────

const EmptyDetailPlaceholder: React.FC<{ message: string }> = ({ message }) => (
	<div className="flex items-center justify-center h-full text-sm text-dash-text-muted">
		{message}
	</div>
);

// ─── Source group header ───────────────────────────────────────────────────────

function SourceGroupHeader({ label, count }: { label: string; count: number }) {
	return (
		<div className="flex items-center gap-2 px-2 py-1.5">
			<span className="text-xs font-bold text-dash-text-muted uppercase tracking-wider flex-1">
				{label}
			</span>
			<span className="text-[10px] px-1.5 py-0.5 rounded bg-dash-accent-subtle text-dash-accent font-semibold">
				{count}
			</span>
		</div>
	);
}

// ─── Main page ─────────────────────────────────────────────────────────────────

const SkillsBrowserPage: React.FC = () => {
	const { t } = useI18n();
	const [searchParams] = useSearchParams();
	const { skills, loading, error } = useSkillsBrowser();
	const [search, setSearch] = useState("");
	const [selectedName, setSelectedName] = useState<string | null>(null);
	const skillItemRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

	// Auto-select skill from URL query param (e.g., /skills?name=plan)
	// IMPORTANT: Some skills have "ck-" prefix in folder names (e.g., "ck-plan", "ck-debug")
	// but are invoked without prefix in commands (e.g., "/ck:plan" extracts "plan").
	// This effect checks both exact match and "ck-{name}" prefixed match.
	useEffect(() => {
		const nameParam = searchParams.get("name");
		if (nameParam && skills.length > 0) {
			const nameLower = nameParam.toLowerCase();
			const ckPrefixedName = `ck-${nameLower}`;

			// Find skill by exact match, case-insensitive match, or ck-prefixed match
			const match = skills.find(
				(s) =>
					s.name === nameParam ||
					s.name.toLowerCase() === nameLower ||
					s.name.toLowerCase() === ckPrefixedName,
			);
			if (match) {
				setSelectedName(match.name);
				// Scroll the selected skill into view after a brief delay for DOM update
				requestAnimationFrame(() => {
					const element = skillItemRefs.current.get(match.name);
					if (element) {
						element.scrollIntoView({ behavior: "smooth", block: "center" });
					}
				});
			}
		}
	}, [searchParams, skills]);

	const { size, isDragging, startDrag } = useResizable({
		storageKey: "ck-skills-panel-width",
		defaultSize: 380,
		minSize: 260,
		maxSize: 650,
	});

	const filtered = useMemo(() => {
		if (!search.trim()) return skills;
		const q = search.toLowerCase();
		return skills.filter(
			(s) =>
				s.name.toLowerCase().includes(q) ||
				s.description?.toLowerCase().includes(q) ||
				s.triggers?.some((tr) => tr.toLowerCase().includes(q)),
		);
	}, [skills, search]);

	// Group by source
	const groups = useMemo(() => {
		const map = new Map<string, SkillBrowserItem[]>();
		for (const skill of filtered) {
			const label = skill.source === "github" ? "GitHub" : t("skillLocal");
			const arr = map.get(label) ?? [];
			arr.push(skill);
			map.set(label, arr);
		}
		return map;
	}, [filtered, t]);

	return (
		<div className="flex h-full overflow-hidden">
			{/* Left panel: list */}
			<div
				style={{ width: `${size}px` }}
				className="shrink-0 flex flex-col overflow-hidden border-r border-dash-border"
			>
				{/* Header */}
				<div className="shrink-0 px-4 pt-4 pb-3 border-b border-dash-border">
					<div className="flex items-start justify-between mb-3">
						<div>
							<h1 className="text-base font-bold text-dash-text">{t("skillsBrowser")}</h1>
							{!loading && !error && (
								<p className="text-xs text-dash-text-muted mt-0.5">
									{t("skillsCount").replace("{count}", String(skills.length))}
								</p>
							)}
							<p className="text-[11px] text-dash-text-muted font-mono mt-0.5">~/.claude/skills/</p>
						</div>
						<span className="text-xs px-2 py-0.5 rounded bg-dash-accent-subtle text-dash-accent font-semibold shrink-0">
							{t("sessionReadOnly")}
						</span>
					</div>

					{/* Search */}
					<div className="relative">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dash-text-muted pointer-events-none"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
							/>
						</svg>
						<input
							type="text"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder={t("searchSkillsBrowserPlaceholder")}
							className="w-full pl-9 pr-4 py-2 text-sm bg-dash-surface border border-dash-border rounded-lg text-dash-text placeholder:text-dash-text-muted focus:outline-none focus:border-dash-accent/50 transition-colors"
						/>
						{search && (
							<button
								type="button"
								onClick={() => setSearch("")}
								className="absolute right-3 top-1/2 -translate-y-1/2 text-dash-text-muted hover:text-dash-text transition-colors"
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
										d="M6 18L18 6M6 6l12 12"
									/>
								</svg>
							</button>
						)}
					</div>
				</div>

				{/* Body */}
				<div className="flex-1 overflow-y-auto px-2 py-2">
					{loading && (
						<div className="flex flex-1 items-center justify-center text-dash-text-muted text-sm p-8">
							{t("loadingSkills")}
						</div>
					)}

					{!loading && error && (
						<div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-900/20 p-4 text-red-600 dark:text-red-400 text-sm m-2">
							{error}
						</div>
					)}

					{!loading && !error && groups.size === 0 && (
						<div className="flex items-center justify-center p-8 text-dash-text-muted text-sm">
							{t("noSkillsBrowserFound")}
						</div>
					)}

					{!loading && !error && groups.size > 0 && (
						<div className="flex flex-col gap-2 pb-4">
							{Array.from(groups.entries()).map(([label, groupSkills]) => (
								<div key={label}>
									{groups.size > 1 && (
										<SourceGroupHeader label={label} count={groupSkills.length} />
									)}
									<div className="space-y-0.5">
										{groupSkills.map((skill) => (
											<SkillItem
												key={skill.name}
												ref={(el) => {
													if (el) skillItemRefs.current.set(skill.name, el);
													else skillItemRefs.current.delete(skill.name);
												}}
												skill={skill}
												selected={selectedName === skill.name}
												onClick={() => setSelectedName(skill.name)}
											/>
										))}
									</div>
								</div>
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
