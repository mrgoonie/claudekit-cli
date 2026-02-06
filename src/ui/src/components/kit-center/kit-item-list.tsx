/**
 * List of kit items in selected category
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
}

const KitItemList: React.FC<KitItemListProps> = ({
	items,
	category,
	selectedItem,
	onSelectItem,
}) => {
	const { t } = useI18n();

	if (items.length === 0) {
		return (
			<div className="text-center py-12">
				<p className="text-dash-text-muted">{t("kitNoItems")}</p>
			</div>
		);
	}

	return (
		<div className="space-y-1">
			{items.map((item) => {
				const isSelected = selectedItem?.name === item.name;

				return (
					<button
						key={`${category}-${item.name}`}
						type="button"
						onClick={() => onSelectItem(item)}
						className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all ${
							isSelected
								? "bg-dash-accent/10 border border-dash-accent/30"
								: "border border-transparent hover:bg-dash-surface-hover"
						}`}
					>
						<div className="flex-1 min-w-0">
							<div className="flex items-center gap-2">
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
								<p className="text-xs text-dash-text-muted mt-0.5">
									<span className="text-dash-text-secondary">{t("kitEvent")}:</span> {item.event}
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
	);
};

export default KitItemList;
