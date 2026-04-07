/**
 * Suggestions panel — severity-based list of config warnings and tips
 */
import type { DashboardSuggestion } from "../../hooks/use-dashboard-data";

const SUGGESTION_STYLES: Record<
	DashboardSuggestion["type"],
	{ container: string; icon: string; text: string }
> = {
	warning: {
		container: "border-orange-500/20 bg-orange-500/5",
		icon: "[!]",
		text: "text-orange-600 dark:text-orange-400",
	},
	info: {
		container: "border-dash-border bg-dash-bg",
		icon: "[i]",
		text: "text-dash-text-secondary",
	},
	success: {
		container: "border-green-500/20 bg-green-500/5",
		icon: "[OK]",
		text: "text-green-600 dark:text-green-400",
	},
};

interface DashboardSuggestionsPanelProps {
	suggestions: DashboardSuggestion[];
	title: string;
}

export function DashboardSuggestionsPanel({ suggestions, title }: DashboardSuggestionsPanelProps) {
	return (
		<div className="bg-dash-surface border border-dash-border rounded-xl shadow-sm flex flex-col min-h-0">
			<div className="px-4 py-3 border-b border-dash-border shrink-0">
				<h3 className="text-sm font-bold text-dash-text-secondary uppercase tracking-widest">
					{title}
				</h3>
			</div>
			<div className="p-3 flex flex-col gap-2 overflow-y-auto">
				{suggestions.length === 0 ? (
					<div className="py-6 text-center text-dash-text-muted text-sm">—</div>
				) : (
					suggestions.map((s, idx) => {
						const style = SUGGESTION_STYLES[s.type];
						return (
							<div
								key={idx}
								className={`flex items-start gap-2 rounded-lg border px-3 py-2 ${style.container}`}
							>
								<span className={`shrink-0 text-[10px] font-bold font-mono mt-0.5 ${style.text}`}>
									{style.icon}
								</span>
								<span className={`text-xs leading-snug ${style.text}`}>{s.message}</span>
							</div>
						);
					})
				)}
			</div>
		</div>
	);
}
