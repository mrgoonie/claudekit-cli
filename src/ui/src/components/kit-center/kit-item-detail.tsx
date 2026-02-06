/**
 * Detail panel for selected kit item
 */
import type React from "react";
import { useI18n } from "../../i18n";
import type { KitCategory } from "./kit-category-tabs";
import type { KitItem } from "./kit-item-list";

interface KitItemDetailProps {
	item: KitItem;
	category: KitCategory;
	onClose: () => void;
}

const KitItemDetail: React.FC<KitItemDetailProps> = ({ item, category, onClose }) => {
	const { t } = useI18n();

	return (
		<div className="border-l border-dash-border bg-dash-surface w-80 shrink-0 flex flex-col">
			{/* Header */}
			<div className="flex items-center justify-between px-4 py-3 border-b border-dash-border">
				<h3 className="text-sm font-semibold text-dash-text truncate">{item.name}</h3>
				<button
					type="button"
					onClick={onClose}
					className="text-dash-text-muted hover:text-dash-text transition-colors"
				>
					<svg className="w-4 h-4 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth={2}>
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			</div>

			{/* Content */}
			<div className="flex-1 overflow-y-auto p-4 space-y-4">
				{/* Type badge */}
				<div>
					<span className="text-[10px] font-semibold uppercase tracking-wide text-dash-text-muted">
						{t("kitType")}
					</span>
					<div className="mt-1">
						<span className="text-xs bg-dash-accent/10 text-dash-accent px-2 py-1 rounded">
							{t(`kitCategory_${category}` as Parameters<typeof t>[0])}
						</span>
					</div>
				</div>

				{/* Description */}
				{item.description && (
					<div>
						<span className="text-[10px] font-semibold uppercase tracking-wide text-dash-text-muted">
							{t("description")}
						</span>
						<p className="text-sm text-dash-text-secondary mt-1">{item.description}</p>
					</div>
				)}

				{/* File name */}
				{item.fileName && (
					<div>
						<span className="text-[10px] font-semibold uppercase tracking-wide text-dash-text-muted">
							{t("kitFileName")}
						</span>
						<p className="text-sm text-dash-text font-mono mt-1 bg-dash-bg px-2 py-1 rounded">
							{item.fileName}
						</p>
					</div>
				)}

				{/* Hook-specific: event */}
				{item.event && (
					<div>
						<span className="text-[10px] font-semibold uppercase tracking-wide text-dash-text-muted">
							{t("kitEvent")}
						</span>
						<p className="text-sm text-dash-text font-mono mt-1 bg-dash-bg px-2 py-1 rounded">
							{item.event}
						</p>
					</div>
				)}

				{/* Hook-specific: command */}
				{item.command && (
					<div>
						<span className="text-[10px] font-semibold uppercase tracking-wide text-dash-text-muted">
							{t("kitCommand")}
						</span>
						<p className="text-sm text-dash-text font-mono mt-1 bg-dash-bg px-2 py-1 rounded break-all">
							{item.command}
						</p>
					</div>
				)}

				{/* Skill-specific badges */}
				{category === "skills" && (
					<div className="flex gap-2">
						{item.hasScript && (
							<span className="text-xs bg-blue-500/10 text-blue-500 px-2 py-1 rounded">
								{t("kitHasScript")}
							</span>
						)}
						{item.hasDeps && (
							<span className="text-xs bg-amber-500/10 text-amber-500 px-2 py-1 rounded">
								{t("kitHasDeps")}
							</span>
						)}
					</div>
				)}

				{/* Nested badge for commands */}
				{item.isNested && (
					<div>
						<span className="text-xs bg-dash-surface-hover text-dash-text-muted px-2 py-1 rounded">
							{t("kitNested")}
						</span>
					</div>
				)}
			</div>
		</div>
	);
};

export default KitItemDetail;
