/**
 * Kit category tab bar for KitCenterPage
 */
import type React from "react";
import { useI18n } from "../../i18n";

export type KitCategory = "skills" | "agents" | "hooks" | "rules" | "commands";

interface KitCategoryTabsProps {
	selected: KitCategory;
	onSelect: (category: KitCategory) => void;
	counts: Record<KitCategory, number>;
}

const CATEGORIES: KitCategory[] = ["skills", "agents", "hooks", "rules", "commands"];

const CATEGORY_ICONS: Record<KitCategory, React.ReactNode> = {
	skills: (
		<svg className="w-4 h-4 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth={1.5}>
			<path d="M12 2L2 7l10 5 10-5-10-5z" />
			<path d="M2 17l10 5 10-5" />
			<path d="M2 12l10 5 10-5" />
		</svg>
	),
	agents: (
		<svg className="w-4 h-4 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth={1.5}>
			<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
			<circle cx="12" cy="7" r="4" />
		</svg>
	),
	hooks: (
		<svg className="w-4 h-4 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth={1.5}>
			<polyline points="16 18 22 12 16 6" />
			<polyline points="8 6 2 12 8 18" />
		</svg>
	),
	rules: (
		<svg className="w-4 h-4 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth={1.5}>
			<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
			<polyline points="14 2 14 8 20 8" />
			<line x1="16" y1="13" x2="8" y2="13" />
			<line x1="16" y1="17" x2="8" y2="17" />
		</svg>
	),
	commands: (
		<svg className="w-4 h-4 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth={1.5}>
			<polyline points="4 17 10 11 4 5" />
			<line x1="12" y1="19" x2="20" y2="19" />
		</svg>
	),
};

const KitCategoryTabs: React.FC<KitCategoryTabsProps> = ({ selected, onSelect, counts }) => {
	const { t } = useI18n();

	return (
		<div className="flex gap-1 border-b border-dash-border bg-dash-surface px-8">
			{CATEGORIES.map((cat) => (
				<button
					key={cat}
					type="button"
					onClick={() => onSelect(cat)}
					className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
						selected === cat
							? "border-dash-accent text-dash-accent"
							: "border-transparent text-dash-text-muted hover:text-dash-text hover:border-dash-border"
					}`}
				>
					{CATEGORY_ICONS[cat]}
					<span>{t(`kitCategory_${cat}` as Parameters<typeof t>[0])}</span>
					<span className="text-[10px] bg-dash-surface-hover text-dash-text-muted px-1.5 py-0.5 rounded-full">
						{counts[cat]}
					</span>
				</button>
			))}
		</div>
	);
};

export default KitCategoryTabs;
