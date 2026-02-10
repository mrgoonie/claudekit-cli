/**
 * Kit item list with inline search and category-aware empty states
 */
import type React from "react";
import { useI18n } from "../../i18n";
import type { KitCategory } from "./kit-category-tabs";

export interface KitItem {
	name: string;
	description?: string;
	fileName?: string;
	event?: string;
	command?: string;
	isNested?: boolean;
	hasScript?: boolean;
	hasDeps?: boolean;
}

interface KitItemListProps {
	items: KitItem[];
	category: KitCategory;
	selectedItem: KitItem | null;
	onSelectItem: (item: KitItem) => void;
	searchQuery: string;
	onSearchChange: (query: string) => void;
}

const CATEGORY_EMPTY_ICONS: Record<KitCategory, React.ReactNode> = {
	skills: (
		<svg className="w-10 h-10 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth={1}>
			<path d="M12 2L2 7l10 5 10-5-10-5z" />
			<path d="M2 17l10 5 10-5" />
			<path d="M2 12l10 5 10-5" />
		</svg>
	),
	agents: (
		<svg className="w-10 h-10 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth={1}>
			<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
			<circle cx="12" cy="7" r="4" />
		</svg>
	),
	hooks: (
		<svg className="w-10 h-10 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth={1}>
			<polyline points="16 18 22 12 16 6" />
			<polyline points="8 6 2 12 8 18" />
		</svg>
	),
	rules: (
		<svg className="w-10 h-10 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth={1}>
			<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
			<polyline points="14 2 14 8 20 8" />
			<line x1="16" y1="13" x2="8" y2="13" />
			<line x1="16" y1="17" x2="8" y2="17" />
		</svg>
	),
	commands: (
		<svg className="w-10 h-10 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth={1}>
			<polyline points="4 17 10 11 4 5" />
			<line x1="12" y1="19" x2="20" y2="19" />
		</svg>
	),
};

const KitItemList: React.FC<KitItemListProps> = ({
	items,
	category,
	selectedItem,
	onSelectItem,
	searchQuery,
	onSearchChange,
}) => {
	const { t } = useI18n();

	return (
		<div className="space-y-3">
			{/* Search bar */}
			<div className="relative">
				<svg
					className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dash-text-muted"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					strokeWidth={2}
				>
					<circle cx="11" cy="11" r="8" />
					<line x1="21" y1="21" x2="16.65" y2="16.65" />
				</svg>
				<input
					type="text"
					value={searchQuery}
					onChange={(e) => onSearchChange(e.target.value)}
					placeholder={t("kitSearchPlaceholder")}
					className="w-full pl-9 pr-3 py-2 text-sm bg-dash-bg border border-dash-border-subtle rounded-lg text-dash-text placeholder:text-dash-text-muted focus:outline-none focus:border-dash-accent focus:ring-1 focus:ring-dash-accent/30 transition-colors"
				/>
				{searchQuery && (
					<button
						type="button"
						onClick={() => onSearchChange("")}
						className="absolute right-3 top-1/2 -translate-y-1/2 text-dash-text-muted hover:text-dash-text"
					>
						<svg
							className="w-3.5 h-3.5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							strokeWidth={2}
						>
							<line x1="18" y1="6" x2="6" y2="18" />
							<line x1="6" y1="6" x2="18" y2="18" />
						</svg>
					</button>
				)}
			</div>

			{/* Results count */}
			<div className="text-[11px] text-dash-text-muted uppercase tracking-wide px-1">
				{items.length} {t(`kitCategory_${category}` as Parameters<typeof t>[0])}
				{searchQuery && ` — "${searchQuery}"`}
			</div>

			{/* Item list */}
			{items.length === 0 ? (
				<div className="text-center py-16">
					<div className="text-dash-text-muted/40 mb-3 flex justify-center">
						{CATEGORY_EMPTY_ICONS[category]}
					</div>
					<p className="text-sm text-dash-text-muted">
						{searchQuery ? t("kitNoSearchResults") : t("kitNoItems")}
					</p>
				</div>
			) : (
				<div className="space-y-1">
					{items.map((item) => {
						const isSelected = selectedItem?.name === item.name;
						return (
							<button
								key={`${category}-${item.name}`}
								type="button"
								onClick={() => onSelectItem(item)}
								className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
									isSelected
										? "bg-dash-accent/10 border border-dash-accent/30"
										: "border border-transparent hover:bg-dash-surface-hover"
								}`}
							>
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2 flex-wrap">
										<span className="text-sm font-medium text-dash-text truncate">{item.name}</span>
										{item.isNested && (
											<span className="text-[10px] text-dash-text-muted bg-dash-surface px-1.5 py-0.5 rounded">
												{t("kitNested")}
											</span>
										)}
										{item.hasScript && (
											<span className="text-[10px] text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded">
												{t("kitHasScript")}
											</span>
										)}
										{item.hasDeps && (
											<span className="text-[10px] text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">
												{t("kitHasDeps")}
											</span>
										)}
									</div>
									{item.description && (
										<p className="text-xs text-dash-text-secondary mt-0.5 truncate">
											{item.description}
										</p>
									)}
									{item.event && (
										<p className="text-xs text-dash-text-muted mt-0.5 font-mono truncate">
											{item.event}
										</p>
									)}
								</div>
								<svg
									className="w-4 h-4 text-dash-text-muted shrink-0"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									strokeWidth={2}
								>
									<path d="M9 5l7 7-7 7" />
								</svg>
							</button>
						);
					})}
				</div>
			)}
		</div>
	);
};

export default KitItemList;
