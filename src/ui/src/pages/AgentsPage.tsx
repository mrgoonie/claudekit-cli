/**
 * Agents browser page — split-panel layout: card list on left, detail on right.
 * Route: /agents
 * Detail inlined from AgentDetailPage (removed separate route).
 */
import type React from "react";
import { useMemo, useState } from "react";
import ResizeHandle from "../components/ResizeHandle";
import MarkdownRenderer from "../components/markdown-renderer";
import { useAgentDetail, useAgentsBrowser } from "../hooks/use-agents-browser";
import type { AgentListItem } from "../hooks/use-agents-browser";
import { useResizable } from "../hooks/useResizable";
import { useI18n } from "../i18n";

// ─── Model filter chip types ───────────────────────────────────────────────

type ModelFilter = "all" | "opus" | "sonnet" | "haiku" | "unset";

function classifyModel(model: string | null): ModelFilter {
	if (!model) return "unset";
	const m = model.toLowerCase();
	if (m.includes("opus")) return "opus";
	if (m.includes("sonnet")) return "sonnet";
	if (m.includes("haiku")) return "haiku";
	return "unset";
}

// ─── Model badge color ─────────────────────────────────────────────────────

const MODEL_BADGE_STYLES: Record<string, string> = {
	opus: "bg-[hsl(217_70%_55%/0.15)] text-[hsl(217_70%_65%)] border-[hsl(217_70%_55%/0.3)]",
	sonnet: "bg-[hsl(var(--accent)/0.15)] text-[hsl(var(--accent))] border-[hsl(var(--accent)/0.3)]",
	haiku: "bg-[hsl(38_65%_50%/0.15)] text-[hsl(38_65%_65%)] border-[hsl(38_65%_50%/0.3)]",
	unset: "bg-[var(--muted)] text-[var(--muted-foreground)] border-[var(--border)]",
};

function modelBadgeStyle(model: string | null): string {
	return MODEL_BADGE_STYLES[classifyModel(model)] ?? MODEL_BADGE_STYLES.unset;
}

function modelLabel(model: string | null): string {
	if (!model) return "Unset";
	return model;
}

// ─── Agent card ────────────────────────────────────────────────────────────

interface AgentCardProps {
	agent: AgentListItem;
	selected: boolean;
	onClick: () => void;
}

const ACCENT_FALLBACK = "hsl(var(--accent))";

const AgentCard: React.FC<AgentCardProps> = ({ agent, selected, onClick }) => {
	const accentColor = agent.color || ACCENT_FALLBACK;

	return (
		<button
			type="button"
			onClick={onClick}
			className={[
				"relative flex flex-col text-left rounded-xl overflow-hidden border transition-colors duration-150",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent))]",
				selected
					? "bg-[hsl(var(--accent)/0.08)] border-[hsl(var(--accent)/0.5)]"
					: "bg-[var(--card)] border-[var(--border)] hover:border-[hsl(var(--accent)/0.4)]",
			].join(" ")}
		>
			{/* 3px colored top accent bar */}
			<div className="h-[3px] w-full shrink-0" style={{ backgroundColor: accentColor }} />

			<div className="flex flex-col gap-2 p-4 flex-1">
				{/* Name */}
				<p className="text-sm font-semibold text-[var(--foreground)] truncate">{agent.name}</p>

				{/* Description — 2-line clamp */}
				<p
					className="text-xs text-[var(--muted-foreground)] leading-relaxed"
					style={{
						display: "-webkit-box",
						WebkitLineClamp: 2,
						WebkitBoxOrient: "vertical",
						overflow: "hidden",
					}}
				>
					{agent.description || "\u00a0"}
				</p>

				{/* Footer: model badge + skill count */}
				<div className="flex items-center justify-between mt-auto pt-2">
					<span
						className={`text-[10px] font-medium px-2 py-0.5 rounded-full border truncate max-w-[130px] ${modelBadgeStyle(agent.model)}`}
					>
						{modelLabel(agent.model)}
					</span>
					{agent.skillCount > 0 && (
						<span className="text-[10px] text-[var(--muted-foreground)] shrink-0">
							{agent.skillCount} tool{agent.skillCount !== 1 ? "s" : ""}
						</span>
					)}
				</div>
			</div>
		</button>
	);
};

// ─── Filter chip ───────────────────────────────────────────────────────────

interface FilterChipProps {
	label: string;
	active: boolean;
	onClick: () => void;
}

const FilterChip: React.FC<FilterChipProps> = ({ label, active, onClick }) => (
	<button
		type="button"
		onClick={onClick}
		className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${active ? "bg-[hsl(var(--accent)/0.15)] text-[hsl(var(--accent))] border-[hsl(var(--accent)/0.3)]" : "bg-transparent text-[var(--muted-foreground)] border-[var(--border)] hover:border-[hsl(var(--accent)/0.4)] hover:text-[var(--foreground)]"}`}
	>
		{label}
	</button>
);

// ─── Frontmatter table ─────────────────────────────────────────────────────

const SKIP_KEYS = new Set(["name", "description", "color"]);

const FrontmatterTable: React.FC<{ frontmatter: Record<string, unknown> }> = ({ frontmatter }) => {
	const entries = Object.entries(frontmatter).filter(
		([k, v]) => !SKIP_KEYS.has(k) && v !== undefined && v !== null && v !== "",
	);

	if (entries.length === 0) return null;

	return (
		<div className="rounded-lg border border-[var(--border)] overflow-hidden text-sm">
			<table className="w-full">
				<tbody>
					{entries.map(([key, value]) => (
						<tr key={key} className="border-b border-[var(--border)] last:border-0">
							<td className="px-3 py-2 font-mono text-xs text-[var(--muted-foreground)] bg-[var(--muted)] w-32 shrink-0 align-top">
								{key}
							</td>
							<td className="px-3 py-2 text-xs text-[var(--foreground)] break-all">
								{typeof value === "object" ? JSON.stringify(value) : String(value)}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
};

// ─── Agent detail panel ────────────────────────────────────────────────────

const AgentDetailPanel: React.FC<{ slug: string }> = ({ slug }) => {
	const { t } = useI18n();
	const { agent, loading, error } = useAgentDetail(slug);
	const accentColor = agent?.color || ACCENT_FALLBACK;

	if (loading) {
		return (
			<div className="flex items-center justify-center h-32 text-sm text-[var(--muted-foreground)]">
				{t("loading")}
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex items-center justify-center h-32 text-sm text-red-500">{error}</div>
		);
	}

	if (!agent) return null;

	return (
		<div className="space-y-6">
			{/* Agent header */}
			<div className="flex items-start gap-3">
				<div
					className="mt-1 w-3 h-3 rounded-full shrink-0"
					style={{ backgroundColor: accentColor }}
				/>
				<div className="min-w-0">
					<h2 className="text-lg font-bold text-[var(--foreground)] truncate">{agent.name}</h2>
					{agent.description && (
						<p className="text-sm text-[var(--muted-foreground)] mt-0.5">{agent.description}</p>
					)}
					<p className="text-[10px] text-[var(--muted-foreground)] mt-1 font-mono">
						{agent.dirLabel}/{slug}.md
					</p>
				</div>
			</div>

			{/* Frontmatter */}
			<section>
				<h3 className="text-xs font-bold uppercase tracking-widest text-[var(--muted-foreground)] mb-3">
					{t("agentFrontmatter")}
				</h3>
				<FrontmatterTable frontmatter={agent.frontmatter} />
			</section>

			{/* Instructions */}
			{agent.body && (
				<section>
					<h3 className="text-xs font-bold uppercase tracking-widest text-[var(--muted-foreground)] mb-3">
						{t("agentInstructions")}
					</h3>
					<div className="rounded-lg border border-[var(--border)] bg-[var(--muted)] p-4 overflow-auto">
						<MarkdownRenderer content={agent.body} />
					</div>
				</section>
			)}
		</div>
	);
};

// ─── Empty placeholder ─────────────────────────────────────────────────────

const EmptyDetailPlaceholder: React.FC<{ message: string }> = ({ message }) => (
	<div className="flex items-center justify-center h-full text-sm text-[var(--muted-foreground)]">
		{message}
	</div>
);

// ─── Main page ─────────────────────────────────────────────────────────────

const AgentsPage: React.FC = () => {
	const { t } = useI18n();
	const { agents, loading, error } = useAgentsBrowser();

	const [search, setSearch] = useState("");
	const [modelFilter, setModelFilter] = useState<ModelFilter>("all");
	const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

	const { size, isDragging, startDrag } = useResizable({
		storageKey: "ck-agents-panel-width",
		defaultSize: 420,
		minSize: 260,
		maxSize: 700,
	});

	// Apply filters
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

	const countLabel = t("agentsBrowserCount").replace("{count}", String(agents.length));

	return (
		<div className="flex h-full overflow-hidden">
			{/* Left panel: list */}
			<div
				style={{ width: `${size}px` }}
				className="shrink-0 flex flex-col overflow-hidden border-r border-[var(--border)]"
			>
				{/* Header */}
				<div className="shrink-0 px-4 pt-4 pb-3 border-b border-[var(--border)]">
					<div className="mb-3">
						<h1 className="text-base font-bold text-[var(--foreground)]">{t("agentsBrowser")}</h1>
						{!loading && (
							<p className="text-xs text-[var(--muted-foreground)] mt-0.5">{countLabel}</p>
						)}
						<p className="text-[11px] text-[var(--muted-foreground)] font-mono mt-0.5">
							~/.claude/agents/
						</p>
					</div>

					{/* Search + filter */}
					<div className="flex flex-col gap-2">
						<div className="relative">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--muted-foreground)] pointer-events-none"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M21 21l-4.35-4.35M17 11A6 6 0 1 0 5 11a6 6 0 0 0 12 0z"
								/>
							</svg>
							<input
								type="search"
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								placeholder={t("searchAgentsPlaceholder")}
								className={
									"w-full pl-8 pr-3 py-1.5 text-sm rounded-lg " +
									"bg-[var(--muted)] border border-[var(--border)] " +
									"text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] " +
									"focus:outline-none focus:border-[hsl(var(--accent)/0.5)]"
								}
							/>
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
				</div>

				{/* Body */}
				<div className="flex-1 overflow-y-auto px-4 py-3">
					{loading && (
						<div className="flex items-center justify-center h-32 text-sm text-[var(--muted-foreground)]">
							{t("loading")}
						</div>
					)}

					{!loading && error && (
						<div className="flex items-center justify-center h-32 text-sm text-red-500">
							{error}
						</div>
					)}

					{!loading && !error && groups.size === 0 && (
						<div className="flex items-center justify-center h-32 text-sm text-[var(--muted-foreground)]">
							{t("noAgentsFound")}
						</div>
					)}

					{!loading && !error && groups.size > 0 && (
						<div className="space-y-6">
							{Array.from(groups.entries()).map(([dirLabel, groupAgents]) => (
								<section key={dirLabel}>
									{groups.size > 1 && (
										<div className="flex items-center gap-2 mb-2">
											<span className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
												{dirLabel}
											</span>
											<div className="flex-1 h-px bg-[var(--border)]" />
											<span className="text-[10px] text-[var(--muted-foreground)]">
												{groupAgents.length}
											</span>
										</div>
									)}

									<div className="grid grid-cols-1 gap-2">
										{groupAgents.map((agent) => (
											<AgentCard
												key={`${agent.dirLabel}/${agent.slug}`}
												agent={agent}
												selected={selectedSlug === agent.slug}
												onClick={() => setSelectedSlug(agent.slug)}
											/>
										))}
									</div>
								</section>
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
