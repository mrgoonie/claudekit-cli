/**
 * Kit Center page - browse installed kit components and changelog
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

	// Map inventory to KitItems based on selected category
	const items: KitItem[] = useMemo(() => {
		if (!inventory) return [];

		switch (selectedCategory) {
			case "skills":
				return inventory.skills.map((s) => ({
					name: s.name,
					description: s.description,
					hasScript: s.hasScript,
					hasDeps: s.hasDeps,
				}));
			case "agents":
				return inventory.agents.map((a) => ({
					name: a.name,
					description: a.description,
					fileName: a.fileName,
				}));
			case "hooks":
				return inventory.hooks.map((h) => ({
					name: h.fileName,
					event: h.event,
					command: h.command,
					fileName: h.fileName,
				}));
			case "rules":
				return inventory.rules.map((r) => ({
					name: r.name,
					fileName: r.fileName,
				}));
			case "commands":
				return inventory.commands.map((c) => ({
					name: c.name,
					fileName: c.fileName,
					isNested: c.isNested,
				}));
			default:
				return [];
		}
	}, [inventory, selectedCategory]);

	const counts: Record<KitCategory, number> = useMemo(() => {
		if (!inventory) {
			return { skills: 0, agents: 0, hooks: 0, rules: 0, commands: 0 };
		}
		return {
			skills: inventory.skills.length,
			agents: inventory.agents.length,
			hooks: inventory.hooks.length,
			rules: inventory.rules.length,
			commands: inventory.commands.length,
		};
	}, [inventory]);

	// Clear selected item when category changes
	const handleCategoryChange = (cat: KitCategory) => {
		setSelectedCategory(cat);
		setSelectedItem(null);
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
			{/* Header */}
			<div className="border-b border-dash-border bg-dash-surface px-8 py-5">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-xl font-bold text-dash-text">{t("kitCenterTitle")}</h1>
						<p className="text-sm text-dash-text-muted mt-0.5">{t("kitCenterSubtitle")}</p>
					</div>
					<div className="flex items-center gap-4">
						{/* Kit metadata */}
						<div className="text-right">
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

			{/* Content area */}
			<div className="flex-1 flex overflow-hidden">
				{/* Item list */}
				<div className="flex-1 overflow-y-auto px-8 py-4">
					<KitItemList
						items={items}
						category={selectedCategory}
						selectedItem={selectedItem}
						onSelectItem={setSelectedItem}
					/>
				</div>

				{/* Detail panel */}
				{selectedItem && (
					<KitItemDetail
						item={selectedItem}
						category={selectedCategory}
						onClose={() => setSelectedItem(null)}
					/>
				)}
			</div>

			{/* Changelog section */}
			<div className="border-t border-dash-border bg-dash-surface px-8 py-4">
				<h2 className="text-sm font-semibold text-dash-text mb-3">{t("kitChangelog")}</h2>
				<KitChangelogSection />
			</div>
		</div>
	);
};

export default KitCenterPage;
