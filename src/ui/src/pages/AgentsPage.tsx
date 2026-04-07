/**
 * Agents browser page — split-panel layout: flat list on left, detail on right.
 * Route: /agents
 * Design: mirrors CommandsPage exactly (dash-* CSS vars, same item/detail patterns).
 */
import type React from "react";
import { useMemo, useState } from "react";
import ResizeHandle from "../components/ResizeHandle";
import MarkdownRenderer from "../components/markdown-renderer";
import { useAgentDetail, useAgentsBrowser } from "../hooks/use-agents-browser";
import type { AgentListItem } from "../hooks/use-agents-browser";
import { useResizable } from "../hooks/useResizable";
import { useI18n } from "../i18n";

// ─── Icon ─────────────────────────────────────────────────────────────────────

function AgentIcon() {
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
				d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 001.357 2.059l1.045.467A4.5 4.5 0 0121 15.75v.75m-4.5-6.75a.75.75 0 00-.75.75v3a.75.75 0 001.5 0v-3a.75.75 0 00-.75-.75z"
			/>
		</svg>
	);
}

// ─── Model filter types ────────────────────────────────────────────────────────

type ModelFilter = "all" | "opus" | "sonnet" | "haiku" | "unset";

function classifyModel(model: string | null): ModelFilter {
	if (!model) return "unset";
	const m = model.toLowerCase();
	if (m.includes("opus")) return "opus";
	if (m.includes("sonnet")) return "sonnet";
	if (m.includes("haiku")) return "haiku";
	return "unset";
}

function modelShortLabel(model: string | null): string {
	if (!model) return "unset";
	const classified = classifyModel(model);
	if (classified !== "unset") return classified;
	// Truncate long model IDs
	return model.length > 16 ? `${model.slice(0, 14)}…` : model;
}

// ─── Filter chip ───────────────────────────────────────────────────────────────

interface FilterChipProps {
	label: string;
	active: boolean;
	onClick: () => void;
}

const FilterChip: React.FC<FilterChipProps> = ({ label, active, onClick }) => (
	<button
		type="button"
		onClick={onClick}
		className={[
			"px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors",
			active
				? "bg-dash-accent-subtle text-dash-accent border-dash-accent/30"
				: "bg-transparent text-dash-text-muted border-dash-border hover:border-dash-accent/40 hover:text-dash-text",
		].join(" ")}
	>
		{label}
	</button>
);

// ─── Agent list item ───────────────────────────────────────────────────────────

function AgentItem({
	agent,
	selected,
	onClick,
}: {
	agent: AgentListItem;
	selected: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={[
				"w-full flex items-start gap-2 px-3 py-2 rounded-md transition-colors text-left group",
				selected
					? "bg-dash-accent/10 border border-dash-accent/30"
					: "hover:bg-dash-surface-hover border border-transparent",
			].join(" ")}
		>
			<AgentIcon />
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-1.5 flex-wrap">
					<span className="text-sm font-semibold text-dash-accent font-mono">{agent.name}</span>
					{agent.model && (
						<span className="text-[10px] px-1.5 py-0.5 rounded bg-dash-accent-subtle text-dash-accent font-medium shrink-0">
							{modelShortLabel(agent.model)}
						</span>
					)}
				</div>
				{agent.description && (
					<p className="text-xs text-dash-text-muted mt-0.5 truncate">{agent.description}</p>
				)}
			</div>
		</button>
	);
}

// ─── Directory group header ────────────────────────────────────────────────────

function DirGroupHeader({ label, count }: { label: string; count: number }) {
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

// ─── Frontmatter table ─────────────────────────────────────────────────────────

const SKIP_KEYS = new Set(["name", "description", "color"]);

const FrontmatterTable: React.FC<{ frontmatter: Record<string, unknown> }> = ({ frontmatter }) => {
	const entries = Object.entries(frontmatter).filter(
		([k, v]) => !SKIP_KEYS.has(k) && v !== undefined && v !== null && v !== "",
	);

	if (entries.length === 0) return null;

	return (
		<div className="rounded-lg border border-dash-border overflow-hidden text-sm">
			<table className="w-full">
				<tbody>
					{entries.map(([key, value]) => (
						<tr key={key} className="border-b border-dash-border last:border-0">
							<td className="px-3 py-2 font-mono text-xs text-dash-text-muted bg-dash-surface w-32 shrink-0 align-top">
								{key}
							</td>
							<td className="px-3 py-2 text-xs text-dash-text break-all">
								{typeof value === "object" ? JSON.stringify(value) : String(value)}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
};

// ─── Agent detail panel ────────────────────────────────────────────────────────

const AgentDetailPanel: React.FC<{ slug: string }> = ({ slug }) => {
	const { t } = useI18n();
	const { agent, loading, error } = useAgentDetail(slug);

	if (loading) {
		return (
			<div className="flex items-center justify-center h-32 text-sm text-dash-text-muted">
				{t("loading")}
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

	if (!agent) return null;

	return (
		<div className="flex flex-col gap-4">
			{/* Title + read-only badge */}
			<div className="flex items-center gap-3">
				<h2 className="text-base font-semibold text-dash-text font-mono truncate flex-1">
					{agent.name}
				</h2>
				<span className="text-xs px-2 py-0.5 rounded bg-dash-accent-subtle text-dash-accent font-semibold shrink-0">
					{t("sessionReadOnly")}
				</span>
			</div>

			{/* Description */}
			{agent.description && (
				<div className="rounded-lg border border-dash-border bg-dash-surface px-4 py-3">
					<p className="text-sm text-dash-text-muted">{agent.description}</p>
				</div>
			)}

			{/* Path badge */}
			<div className="flex items-center gap-2 text-xs text-dash-text-muted">
				<span className="font-mono px-2 py-0.5 rounded bg-dash-surface border border-dash-border text-dash-accent">
					{agent.dirLabel}/{slug}.md
				</span>
			</div>

			{/* Frontmatter table */}
			<FrontmatterTable frontmatter={agent.frontmatter} />

			{/* Instructions */}
			{agent.body && (
				<div className="rounded-lg border border-dash-border bg-dash-surface p-5 overflow-x-auto">
					<MarkdownRenderer content={agent.body} />
				</div>
			)}
		</div>
	);
};

// ─── Empty placeholder ─────────────────────────────────────────────────────────

const EmptyDetailPlaceholder: React.FC<{ message: string }> = ({ message }) => (
	<div className="flex items-center justify-center h-full text-sm text-dash-text-muted">
		{message}
	</div>
);

// ─── Main page ─────────────────────────────────────────────────────────────────

const AgentsPage: React.FC = () => {
	const { t } = useI18n();
	const { agents, loading, error } = useAgentsBrowser();

	const [search, setSearch] = useState("");
	const [modelFilter, setModelFilter] = useState<ModelFilter>("all");
	const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

	const { size, isDragging, startDrag } = useResizable({
		storageKey: "ck-agents-panel-width",
		defaultSize: 380,
		minSize: 260,
		maxSize: 650,
	});

	// Apply search + model filter
	const filtered = useMemo(() => {
		let result = agents;
		if (search.trim()) {
			const q = search.toLowerCase();
			result = result.filter(
				(a) => a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q),
			);
		}
		if (modelFilter !== "all") {
			result = result.filter((a) => classifyModel(a.model) === modelFilter);
		}
		return result;
	}, [agents, search, modelFilter]);

	// Group by directory label
	const groups = useMemo(() => {
		const map = new Map<string, AgentListItem[]>();
		for (const agent of filtered) {
			const arr = map.get(agent.dirLabel) ?? [];
			arr.push(agent);
			map.set(agent.dirLabel, arr);
		}
		return map;
	}, [filtered]);

	const filterOptions: Array<{ key: ModelFilter; label: string }> = [
		{ key: "all", label: t("filterAll") },
		{ key: "opus", label: "Opus" },
		{ key: "sonnet", label: "Sonnet" },
		{ key: "haiku", label: "Haiku" },
		{ key: "unset", label: "Unset" },
	];

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
							<h1 className="text-base font-bold text-dash-text">{t("agentsBrowser")}</h1>
							{!loading && !error && (
								<p className="text-xs text-dash-text-muted mt-0.5">
									{t("agentsBrowserCount").replace("{count}", String(agents.length))}
								</p>
							)}
							<p className="text-[11px] text-dash-text-muted font-mono mt-0.5">~/.claude/agents/</p>
						</div>
						<span className="text-xs px-2 py-0.5 rounded bg-dash-accent-subtle text-dash-accent font-semibold shrink-0">
							{t("sessionReadOnly")}
						</span>
					</div>

					{/* Search */}
					<div className="relative mb-2">
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
							placeholder={t("searchAgentsPlaceholder")}
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

					{/* Model filter chips */}
					<div className="flex items-center gap-1 flex-wrap">
						{filterOptions.map(({ key, label }) => (
							<FilterChip
								key={key}
								label={label}
								active={modelFilter === key}
								onClick={() => setModelFilter(key)}
							/>
						))}
					</div>
				</div>

				{/* Body */}
				<div className="flex-1 overflow-y-auto px-2 py-2">
					{loading && (
						<div className="flex flex-1 items-center justify-center text-dash-text-muted text-sm p-8">
							{t("loading")}
						</div>
					)}

					{!loading && error && (
						<div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-900/20 p-4 text-red-600 dark:text-red-400 text-sm m-2">
							{error}
						</div>
					)}

					{!loading && !error && groups.size === 0 && (
						<div className="flex items-center justify-center p-8 text-dash-text-muted text-sm">
							{t("noAgentsFound")}
						</div>
					)}

					{!loading && !error && groups.size > 0 && (
						<div className="flex flex-col gap-2 pb-4">
							{Array.from(groups.entries()).map(([dirLabel, groupAgents]) => (
								<div key={dirLabel}>
									{groups.size > 1 && (
										<DirGroupHeader label={dirLabel} count={groupAgents.length} />
									)}
									<div className="space-y-0.5">
										{groupAgents.map((agent) => (
											<AgentItem
												key={`${agent.dirLabel}/${agent.slug}`}
												agent={agent}
												selected={selectedSlug === agent.slug}
												onClick={() => setSelectedSlug(agent.slug)}
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
				{selectedSlug ? (
					<AgentDetailPanel slug={selectedSlug} />
				) : (
					<EmptyDetailPlaceholder message={t("selectToView")} />
				)}
			</div>
		</div>
	);
};

export default AgentsPage;
