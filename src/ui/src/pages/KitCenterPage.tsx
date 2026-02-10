/**
 * Kit Center page - browse installed kit components and changelog
 * Responsive split-panel layout with mobile drawer for detail view
 */
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import KitCategoryTabs from "../components/kit-center/kit-category-tabs";
import type { KitCategory } from "../components/kit-center/kit-category-tabs";
import KitChangelogSection from "../components/kit-center/kit-changelog-section";
import KitItemDetail from "../components/kit-center/kit-item-detail";
import KitItemList from "../components/kit-center/kit-item-list";
import type { KitItem } from "../components/kit-center/kit-item-list";
import { useI18n } from "../i18n";
import { fetchKitInventory } from "../services/api";
import type { KitInventoryResponse } from "../services/api";

const KitCenterPage: React.FC = () => {
	const { t } = useI18n();
	const [inventory, setInventory] = useState<KitInventoryResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [selectedCategory, setSelectedCategory] = useState<KitCategory>("skills");
	const [selectedItem, setSelectedItem] = useState<KitItem | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [showChangelog, setShowChangelog] = useState(false);

	const loadInventory = useCallback(async () => {
		try {
			setLoading(true);
			setError(null);
			const data = await fetchKitInventory();
			setInventory(data);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load kit inventory");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		loadInventory();
	}, [loadInventory]);

	const items: KitItem[] = useMemo(() => {
		if (!inventory) return [];
		const categoryMap: Record<KitCategory, () => KitItem[]> = {
			skills: () =>
				inventory.skills.map((s) => ({
					name: s.name,
					description: s.description,
					hasScript: s.hasScript,
					hasDeps: s.hasDeps,
				})),
			agents: () =>
				inventory.agents.map((a) => ({
					name: a.name,
					description: a.description,
					fileName: a.fileName,
				})),
			hooks: () =>
				inventory.hooks.map((h) => ({
					name: h.fileName,
					event: h.event,
					command: h.command,
					fileName: h.fileName,
				})),
			rules: () => inventory.rules.map((r) => ({ name: r.name, fileName: r.fileName })),
			commands: () =>
				inventory.commands.map((c) => ({
					name: c.name,
					fileName: c.fileName,
					isNested: c.isNested,
				})),
		};
		const mapped = (categoryMap[selectedCategory] || (() => []))();
		if (!searchQuery.trim()) return mapped;
		const q = searchQuery.toLowerCase();
		return mapped.filter(
			(item) =>
				item.name.toLowerCase().includes(q) ||
				item.description?.toLowerCase().includes(q) ||
				item.fileName?.toLowerCase().includes(q),
		);
	}, [inventory, selectedCategory, searchQuery]);

	const counts: Record<KitCategory, number> = useMemo(() => {
		if (!inventory) return { skills: 0, agents: 0, hooks: 0, rules: 0, commands: 0 };
		return {
			skills: inventory.skills.length,
			agents: inventory.agents.length,
			hooks: inventory.hooks.length,
			rules: inventory.rules.length,
			commands: inventory.commands.length,
		};
	}, [inventory]);

	const totalComponents = useMemo(
		() => Object.values(counts).reduce((sum, c) => sum + c, 0),
		[counts],
	);

	const handleCategoryChange = (cat: KitCategory) => {
		setSelectedCategory(cat);
		setSelectedItem(null);
		setSearchQuery("");
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center h-full">
				<div className="text-center">
					<div className="w-8 h-8 border-4 border-dash-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
					<p className="text-dash-text-muted">{t("kitLoading")}</p>
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
						onClick={loadInventory}
						className="px-4 py-2 bg-dash-accent text-white rounded-md hover:bg-dash-accent/90"
					>
						{t("tryAgain")}
					</button>
				</div>
			</div>
		);
	}

	if (!inventory) return null;

	return (
		<div className="h-full flex flex-col">
			{/* Sticky header */}
			<div className="border-b border-dash-border bg-dash-surface px-4 sm:px-8 py-4 sm:py-5">
				<div className="flex items-center justify-between gap-4">
					<div className="min-w-0">
						<h1 className="text-xl font-bold text-dash-text">{t("kitCenterTitle")}</h1>
						<p className="text-sm text-dash-text-muted mt-0.5">{t("kitCenterSubtitle")}</p>
					</div>
					<div className="flex items-center gap-3 sm:gap-4 shrink-0">
						{/* Total count badge */}
						<div className="text-center">
							<div className="text-2xl font-bold text-dash-accent">{totalComponents}</div>
							<div className="text-[11px] text-dash-text-muted uppercase tracking-wide">
								{t("kitTotalComponents")}
							</div>
						</div>
						{/* Changelog toggle */}
						<button
							type="button"
							onClick={() => setShowChangelog(!showChangelog)}
							className={`px-3 py-1.5 border rounded-md text-xs font-medium transition-colors ${
								showChangelog
									? "border-dash-accent text-dash-accent bg-dash-accent/10"
									: "border-dash-border text-dash-text-secondary hover:bg-dash-surface-hover"
							}`}
						>
							{t("kitChangelog")}
						</button>
						{/* Version */}
						<div className="hidden sm:block text-right">
							<div className="text-sm font-medium text-dash-text">{inventory.metadata.name}</div>
							<div className="text-xs text-dash-text-muted">v{inventory.metadata.version}</div>
						</div>
					</div>
				</div>
			</div>

			{/* Category tabs */}
			<KitCategoryTabs
				selected={selectedCategory}
				onSelect={handleCategoryChange}
				counts={counts}
			/>

			{/* Changelog (collapsible) */}
			{showChangelog && (
				<div className="border-b border-dash-border bg-dash-bg px-4 sm:px-8 py-4 max-h-72 overflow-y-auto">
					<KitChangelogSection />
				</div>
			)}

			{/* Content area: list + detail */}
			<div className="flex-1 flex overflow-hidden relative">
				{/* Item list */}
				<div
					className={`flex-1 overflow-y-auto px-4 sm:px-8 py-4 ${selectedItem ? "hidden md:block" : ""}`}
				>
					<KitItemList
						items={items}
						category={selectedCategory}
						selectedItem={selectedItem}
						onSelectItem={setSelectedItem}
						searchQuery={searchQuery}
						onSearchChange={setSearchQuery}
					/>
				</div>

				{/* Detail panel — side panel on desktop, full overlay on mobile */}
				{selectedItem && (
					<>
						{/* Mobile backdrop */}
						<button
							type="button"
							className="md:hidden fixed inset-0 bg-black/40 z-40"
							onClick={() => setSelectedItem(null)}
							aria-label={t("kitCloseDetail")}
						/>
						<div className="fixed inset-y-0 right-0 w-full sm:w-96 md:relative md:w-80 lg:w-96 md:inset-auto z-50 md:z-auto">
							<KitItemDetail
								item={selectedItem}
								category={selectedCategory}
								onClose={() => setSelectedItem(null)}
							/>
						</div>
					</>
				)}
			</div>
		</div>
	);
};

export default KitCenterPage;
