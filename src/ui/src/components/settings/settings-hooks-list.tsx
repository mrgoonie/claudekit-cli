/**
 * Expandable hooks list grouped by event type with enabled/disabled indicators
 */
import type React from "react";
import { useMemo, useState } from "react";
import { useI18n } from "../../i18n";

interface HookItem {
	event: string;
	command: string;
	enabled: boolean;
}

interface SettingsHooksListProps {
	hooks: HookItem[];
	count: number;
}

/** Chevron SVG for expand/collapse */
const ChevronIcon: React.FC<{ expanded: boolean }> = ({ expanded }) => (
	<svg
		className={`w-3.5 h-3.5 text-dash-text-muted transition-transform ${expanded ? "rotate-180" : ""}`}
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
		strokeWidth={2}
	>
		<path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
	</svg>
);

/** Hook lifecycle icon */
const HookIcon: React.FC = () => (
	<svg
		className="w-4 h-4 text-dash-text-muted"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth={1.5}
	>
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M14.25 9.75L16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z"
		/>
	</svg>
);

const SettingsHooksList: React.FC<SettingsHooksListProps> = ({ hooks, count }) => {
	const { t } = useI18n();
	const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

	const enabledCount = useMemo(() => hooks.filter((h) => h.enabled).length, [hooks]);

	if (hooks.length === 0) {
		return (
			<div className="bg-dash-surface rounded-lg border border-dash-border p-5">
				<div className="flex items-center gap-2 mb-3">
					<HookIcon />
					<h3 className="text-sm font-semibold text-dash-text">{t("settingsHooksTitle")}</h3>
				</div>
				<p className="text-xs text-dash-text-muted">{t("settingsNoHooks")}</p>
			</div>
		);
	}

	return (
		<div className="bg-dash-surface rounded-lg border border-dash-border p-5">
			{/* Header with count badges */}
			<div className="flex items-center justify-between mb-3">
				<div className="flex items-center gap-2">
					<HookIcon />
					<h3 className="text-sm font-semibold text-dash-text">{t("settingsHooksTitle")}</h3>
				</div>
				<div className="flex items-center gap-1.5">
					<span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
						{enabledCount} {t("settingsHooksEnabled")}
					</span>
					{count - enabledCount > 0 && (
						<span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-dash-surface-hover text-dash-text-muted">
							{count - enabledCount} {t("settingsHooksDisabled")}
						</span>
					)}
				</div>
			</div>

			{/* Hook items */}
			<div className="space-y-1">
				{hooks.map((hook, i) => {
					const isExpanded = expandedIndex === i;
					return (
						<div
							key={`${hook.event}-${i}`}
							className="border border-dash-border-subtle rounded-md overflow-hidden"
						>
							<button
								type="button"
								onClick={() => setExpandedIndex(isExpanded ? null : i)}
								className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-dash-surface-hover transition-colors"
							>
								<div className="flex items-center gap-2 min-w-0">
									<span
										className={`w-1.5 h-1.5 rounded-full shrink-0 ${hook.enabled ? "bg-emerald-500" : "bg-gray-400"}`}
									/>
									<span className="text-xs font-mono text-dash-text truncate">{hook.event}</span>
								</div>
								<ChevronIcon expanded={isExpanded} />
							</button>
							{isExpanded && (
								<div className="px-3 pb-2.5">
									<pre className="text-[11px] font-mono text-dash-text-secondary bg-dash-bg rounded p-2 overflow-x-auto leading-relaxed">
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
