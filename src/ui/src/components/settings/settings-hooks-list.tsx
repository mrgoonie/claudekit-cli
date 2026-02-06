/**
 * Expandable list of registered hooks from settings
 */
import type React from "react";
import { useState } from "react";
import { useI18n } from "../../i18n";

interface HookItem {
	event: string;
	command: string;
	enabled: boolean;
}

interface SettingsHooksListProps {
	hooks: HookItem[];
}

const SettingsHooksList: React.FC<SettingsHooksListProps> = ({ hooks }) => {
	const { t } = useI18n();
	const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

	if (hooks.length === 0) {
		return (
			<div className="bg-dash-surface rounded-lg border border-dash-border p-4">
				<h3 className="text-sm font-medium text-dash-text mb-2">{t("settingsHooksTitle")}</h3>
				<p className="text-sm text-dash-text-muted">{t("settingsNoHooks")}</p>
			</div>
		);
	}

	return (
		<div className="bg-dash-surface rounded-lg border border-dash-border p-4">
			<h3 className="text-sm font-medium text-dash-text mb-3">
				{t("settingsHooksTitle")} ({hooks.length})
			</h3>
			<div className="space-y-1">
				{hooks.map((hook, i) => {
					const isExpanded = expandedIndex === i;
					return (
						<div key={`${hook.event}-${i}`} className="border border-dash-border rounded-md">
							<button
								type="button"
								onClick={() => setExpandedIndex(isExpanded ? null : i)}
								className="w-full flex items-center justify-between p-2.5 text-left hover:bg-dash-surface-hover rounded-md transition-colors"
							>
								<div className="flex items-center gap-2">
									<span
										className={`w-2 h-2 rounded-full ${hook.enabled ? "bg-green-500" : "bg-gray-400"}`}
									/>
									<span className="text-sm font-mono text-dash-text">{hook.event}</span>
								</div>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									className={`w-4 h-4 text-dash-text-muted transition-transform ${isExpanded ? "rotate-180" : ""}`}
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M19 9l-7 7-7-7"
									/>
								</svg>
							</button>
							{isExpanded && (
								<div className="px-3 pb-3 pt-1">
									<pre className="text-xs font-mono text-dash-text-secondary bg-dash-bg rounded p-2 overflow-x-auto">
										{hook.command}
									</pre>
								</div>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
};

export default SettingsHooksList;
