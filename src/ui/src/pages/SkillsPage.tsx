import type { AgentInfo, SkillInfo, SkillInstallation, SortMode, ViewMode } from "@/types";
/**
 * Skills Dashboard page - category-grouped list view with slide-in detail panel
 */
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import SkillCard from "../components/skills/skill-card-grid";
import DetailPanel from "../components/skills/skill-detail-panel";
import SkillRow from "../components/skills/skill-row";
import { useI18n } from "../i18n";
import {
	fetchAgents,
	fetchInstalledSkills,
	fetchSkills,
	installSkill,
	uninstallSkill,
} from "../services/api";
import {
	CATEGORY_COLORS,
	CATEGORY_ORDER,
	SKILL_CATEGORY_OVERRIDES,
} from "../types/skills-dashboard-types";

const SkillsPage: React.FC = () => {
	const { t } = useI18n();
	const [skills, setSkills] = useState<SkillInfo[]>([]);
	const [installations, setInstallations] = useState<SkillInstallation[]>([]);
	const [agents, setAgents] = useState<AgentInfo[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false); // Background refresh (no spinner)
	const [error, setError] = useState<string | null>(null);

	// UI state
	const [viewMode, setViewMode] = useState<ViewMode>("list");
	const [sortMode, setSortMode] = useState<SortMode>("a-z");
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedCategory, setSelectedCategory] = useState<string>("all");
	const [selectedSkill, setSelectedSkill] = useState<SkillInfo | null>(null);

	const loadData = useCallback(async (isRefresh = false) => {
		try {
			// Only show loading spinner on initial load, not refreshes
			if (!isRefresh) {
				setLoading(true);
			} else {
				setRefreshing(true);
			}
			setError(null);

			const [skillsData, installationsData, agentsData] = await Promise.all([
				fetchSkills(),
				fetchInstalledSkills(),
				fetchAgents(),
			]);

			setSkills(skillsData);
			setInstallations(installationsData.installations);
			setAgents(agentsData.agents);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load skills");
		} finally {
			setLoading(false);
			setRefreshing(false);
		}
	}, []);

	// Load data
	useEffect(() => {
		loadData();
	}, [loadData]);

	// Apply category overrides to skills
	const remappedSkills = useMemo(() => {
		return skills.map((s) => ({
			...s,
			// Use directory id as display name for consistency (kebab-case)
			name: s.id,
			category: SKILL_CATEGORY_OVERRIDES[s.id] || s.category,
		}));
	}, [skills]);

	// Install/uninstall handlers
	const handleInstall = useCallback(
		async (skillName: string, agentNames: string[], global: boolean) => {
			const result = await installSkill(skillName, agentNames, global);
			const failed = result.results.filter((r) => !r.success);
			if (failed.length > 0) {
				throw new Error(`Failed for: ${failed.map((f) => f.agent).join(", ")}`);
			}
			await loadData(true); // Refresh in background
		},
		[loadData],
	);

	const handleUninstall = useCallback(
		async (skillName: string, agentName: string) => {
			await uninstallSkill(skillName, [agentName]);
			await loadData(true); // Refresh in background
		},
		[loadData],
	);

	// Filter and sort skills
	const filteredAndSorted = useMemo(() => {
		let filtered = remappedSkills;

		// Search filter
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter(
				(s) =>
					s.name.toLowerCase().includes(query) ||
					s.description?.toLowerCase().includes(query) ||
					s.category.toLowerCase().includes(query),
			);
		}

		// Category filter
		if (selectedCategory !== "all") {
			filtered = filtered.filter((s) => s.category === selectedCategory);
		}

		// Sort
		const sorted = [...filtered];
		if (sortMode === "a-z") {
			sorted.sort((a, b) => a.name.localeCompare(b.name));
		} else if (sortMode === "category") {
			sorted.sort((a, b) => {
				const catCompare = a.category.localeCompare(b.category);
				if (catCompare !== 0) return catCompare;
				return a.name.localeCompare(b.name);
			});
		} else if (sortMode === "installed-first") {
			sorted.sort((a, b) => {
				const aInstalled = installations.some((i) => i.skillName === a.name);
				const bInstalled = installations.some((i) => i.skillName === b.name);
				if (aInstalled === bInstalled) return a.name.localeCompare(b.name);
				return aInstalled ? -1 : 1;
			});
		}

		return sorted;
	}, [remappedSkills, searchQuery, selectedCategory, sortMode, installations]);

	// Group by category for list view
	const groupedByCategory = useMemo(() => {
		if (viewMode !== "list") return {};

		const groups: Record<string, SkillInfo[]> = {};
		for (const skill of filteredAndSorted) {
			if (!groups[skill.category]) {
				groups[skill.category] = [];
			}
			groups[skill.category].push(skill);
		}

		// Sort groups by CATEGORY_ORDER
		const sortedGroups: Record<string, SkillInfo[]> = {};
		for (const category of CATEGORY_ORDER) {
			if (groups[category]) {
				sortedGroups[category] = groups[category];
			}
		}
		// Add any remaining categories not in CATEGORY_ORDER
		for (const category of Object.keys(groups)) {
			if (!CATEGORY_ORDER.includes(category)) {
				sortedGroups[category] = groups[category];
			}
		}

		return sortedGroups;
	}, [filteredAndSorted, viewMode]);

	// Category counts
	const categoryCounts = useMemo(() => {
		const counts: Record<string, number> = { all: remappedSkills.length };
		for (const skill of remappedSkills) {
			counts[skill.category] = (counts[skill.category] || 0) + 1;
		}
		return counts;
	}, [remappedSkills]);

	// Stats
	const stats = useMemo(() => {
		const installed = new Set(installations.map((i) => i.skillName)).size;
		const detectedAgents = agents.filter((a) => a.detected).length;
		return {
			available: skills.length,
			installed,
			agents: detectedAgents,
		};
	}, [skills, installations, agents]);

	// Keyboard shortcut for search
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
				e.preventDefault();
				document.getElementById("skills-search")?.focus();
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, []);

	if (loading) {
		return (
			<div className="flex items-center justify-center h-full">
				<div className="text-center">
					<div className="w-8 h-8 border-4 border-dash-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
					<p className="text-dash-text-muted">{t("loadingSkills")}</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex items-center justify-center h-full">
				<div className="text-center max-w-md">
					<p className="text-red-500 mb-3">{error}</p>
					<button
						type="button"
						onClick={() => loadData()}
						className="px-4 py-2 bg-dash-accent text-white rounded-md hover:bg-dash-accent/90"
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
			<div className="border-b border-dash-border bg-dash-surface px-8 py-5">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-xl font-bold text-dash-text">{t("skillsTitle")}</h1>
						<p className="text-sm text-dash-text-muted mt-0.5">{t("skillsSubtitle")}</p>
					</div>
					<div className="flex items-center gap-6">
						<div className="text-center">
							<div className="text-xl font-bold text-dash-accent">{stats.available}</div>
							<div className="text-[11px] text-dash-text-muted uppercase tracking-wide">
								{t("availableCount")}
							</div>
						</div>
						<div className="text-center">
							<div className="text-xl font-bold text-dash-accent">{stats.installed}</div>
							<div className="text-[11px] text-dash-text-muted uppercase tracking-wide">
								{t("installedCount")}
							</div>
						</div>
						<div className="text-center">
							<div className="text-xl font-bold text-dash-accent">{stats.agents}</div>
							<div className="text-[11px] text-dash-text-muted uppercase tracking-wide">
								{t("agentsCount")}
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Toolbar */}
			<div className="border-b border-dash-border bg-dash-surface px-8 py-3 space-y-2.5">
				{/* Row 1: Search + actions */}
				<div className="flex items-center gap-3">
					{/* Search */}
					<div className="relative flex-1">
						<svg
							className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 stroke-dash-text-muted"
							fill="none"
							viewBox="0 0 24 24"
							strokeWidth={2}
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<circle cx="11" cy="11" r="8" />
							<line x1="21" y1="21" x2="16.65" y2="16.65" />
						</svg>
						<input
							id="skills-search"
							type="text"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder={t("searchSkills")}
							className="w-full pl-9 pr-12 py-2 bg-dash-bg border border-dash-border rounded-lg text-dash-text text-sm focus:outline-none focus:border-dash-accent transition-colors"
						/>
						<span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-dash-text-muted bg-dash-surface-hover border border-dash-border px-1.5 py-0.5 rounded">
							{t("searchShortcut")}
						</span>
					</div>

					{/* Install All button */}
					<button
						type="button"
						onClick={async () => {
							const detectedAgents = agents.filter((a) => a.detected);
							if (detectedAgents.length === 0) {
								setError(t("noAgentsDetected"));
								return;
							}
							try {
								setRefreshing(true);
								setError(null);
								await Promise.all(
									skills.map((skill) =>
										installSkill(
											skill.name,
											detectedAgents.map((a) => a.name),
											true,
										),
									),
								);
								await loadData(true);
							} catch (err) {
								setError(err instanceof Error ? err.message : t("bulkInstallFailed"));
							} finally {
								setRefreshing(false);
							}
						}}
						disabled={
							loading ||
							refreshing ||
							agents.filter((a) => a.detected).length === 0 ||
							skills.length === 0
						}
						className="px-3 py-1.5 bg-dash-accent text-white rounded-md text-xs font-semibold hover:bg-dash-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
					>
						{refreshing ? t("installing") : t("installAllToAllAgents")}
					</button>

					{/* Sort */}
					<select
						value={sortMode}
						onChange={(e) => setSortMode(e.target.value as SortMode)}
						className="px-2.5 py-1.5 bg-dash-bg border border-dash-border rounded-md text-dash-text-secondary text-xs focus:outline-none"
					>
						<option value="a-z">{t("sortAZ")}</option>
						<option value="category">{t("sortCategory")}</option>
						<option value="installed-first">{t("sortInstalledFirst")}</option>
					</select>

					{/* View toggle */}
					<div className="flex bg-dash-bg border border-dash-border rounded-md overflow-hidden">
						<button
							type="button"
							onClick={() => setViewMode("list")}
							title={t("listView")}
							className={`p-1.5 transition-colors ${
								viewMode === "list"
									? "bg-dash-surface-hover text-dash-accent"
									: "text-dash-text-muted hover:text-dash-text"
							}`}
						>
							<svg
								className="w-3.5 h-3.5 stroke-current"
								fill="none"
								viewBox="0 0 24 24"
								strokeWidth={2}
							>
								<line x1="8" y1="6" x2="21" y2="6" />
								<line x1="8" y1="12" x2="21" y2="12" />
								<line x1="8" y1="18" x2="21" y2="18" />
								<line x1="3" y1="6" x2="3.01" y2="6" />
								<line x1="3" y1="12" x2="3.01" y2="12" />
								<line x1="3" y1="18" x2="3.01" y2="18" />
							</svg>
						</button>
						<button
							type="button"
							onClick={() => setViewMode("grid")}
							title={t("gridView")}
							className={`p-1.5 transition-colors ${
								viewMode === "grid"
									? "bg-dash-surface-hover text-dash-accent"
									: "text-dash-text-muted hover:text-dash-text"
							}`}
						>
							<svg
								className="w-3.5 h-3.5 stroke-current"
								fill="none"
								viewBox="0 0 24 24"
								strokeWidth={2}
							>
								<rect x="3" y="3" width="7" height="7" />
								<rect x="14" y="3" width="7" height="7" />
								<rect x="3" y="14" width="7" height="7" />
								<rect x="14" y="14" width="7" height="7" />
							</svg>
						</button>
					</div>
				</div>

				{/* Row 2: Category pills - horizontal scroll, single line */}
				<div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
					{[
						"all",
						...Array.from(new Set(remappedSkills.map((s) => s.category))).sort((a, b) => {
							const aIdx = CATEGORY_ORDER.indexOf(a);
							const bIdx = CATEGORY_ORDER.indexOf(b);
							if (aIdx === -1 && bIdx === -1) return a.localeCompare(b);
							if (aIdx === -1) return 1;
							if (bIdx === -1) return -1;
							return aIdx - bIdx;
						}),
					].map((cat) => (
						<button
							key={cat}
							type="button"
							onClick={() => setSelectedCategory(cat)}
							className={`px-3 py-1 text-xs font-medium rounded-full border transition-all whitespace-nowrap shrink-0 ${
								selectedCategory === cat
									? "bg-dash-accent/10 border-dash-accent text-dash-accent"
									: "border-dash-border text-dash-text-secondary hover:bg-dash-surface-hover hover:text-dash-text"
							}`}
						>
							{cat === "all" ? t("categoryAll") : cat}
							<span className="opacity-60 ml-1 text-[10px]">{categoryCounts[cat] || 0}</span>
						</button>
					))}
				</div>
			</div>

			{/* Content */}
			<div className="flex-1 overflow-y-auto px-8 py-6">
				{filteredAndSorted.length === 0 ? (
					<div className="text-center py-12">
						<p className="text-dash-text-muted">{t("noSkillsFound")}</p>
					</div>
				) : viewMode === "list" ? (
					// List view - grouped by category
					<div className="space-y-6">
						{Object.entries(groupedByCategory).map(([category, categorySkills]) => (
							<div key={category}>
								{/* Category header */}
								<div className="flex items-center gap-2.5 mb-3">
									<div
										className="w-2 h-2 rounded-full"
										style={{ background: CATEGORY_COLORS[category] || CATEGORY_COLORS.General }}
									/>
									<h2
										className="text-[13px] font-semibold uppercase tracking-wide"
										style={{ color: CATEGORY_COLORS[category] || CATEGORY_COLORS.General }}
									>
										{category}
									</h2>
									<span className="text-[11px] text-dash-text-muted ml-auto">
										{t("skillsCountLabel").replace("{count}", String(categorySkills.length))}
									</span>
									<div className="flex-1 h-px bg-dash-border ml-3" />
								</div>
								{/* Skills list */}
								<div className="space-y-0.5">
									{categorySkills.map((skill) => (
										<SkillRow
											key={skill.id}
											skill={skill}
											installations={installations}
											agents={agents}
											onClick={() => setSelectedSkill(skill)}
										/>
									))}
								</div>
							</div>
						))}
					</div>
				) : (
					// Grid view
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
						{filteredAndSorted.map((skill) => (
							<SkillCard
								key={skill.id}
								skill={skill}
								installations={installations}
								agents={agents}
								onClick={() => setSelectedSkill(skill)}
							/>
						))}
					</div>
				)}
			</div>

			{/* Detail panel */}
			{selectedSkill && (
				<DetailPanel
					skill={selectedSkill}
					installations={installations}
					agents={agents}
					onClose={() => setSelectedSkill(null)}
					onInstall={handleInstall}
					onUninstall={handleUninstall}
				/>
			)}
		</div>
	);
};

export default SkillsPage;
