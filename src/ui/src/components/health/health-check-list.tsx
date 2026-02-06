/**
 * Expandable health check list grouped by status/group
 */
import type React from "react";
import { useState } from "react";
import { useI18n } from "../../i18n";
import type { CheckResultResponse } from "../../services/api";
import HealthFixButton from "./health-fix-button";

interface HealthCheckListProps {
	checks: CheckResultResponse[];
	fixing: Set<string>;
	onFix: (checkIds: string[]) => void;
	selectedGroup: string | null;
}

const STATUS_CONFIG = {
	fail: { label: "healthFailed", color: "text-red-500", bg: "bg-red-500/10", dot: "bg-red-500" },
	warn: {
		label: "healthWarnings",
		color: "text-amber-500",
		bg: "bg-amber-500/10",
		dot: "bg-amber-500",
	},
	pass: {
		label: "healthPassed",
		color: "text-emerald-500",
		bg: "bg-emerald-500/10",
		dot: "bg-emerald-500",
	},
	info: {
		label: "healthInfo",
		color: "text-blue-500",
		bg: "bg-blue-500/10",
		dot: "bg-blue-500",
	},
} as const;

const STATUS_ORDER: Array<keyof typeof STATUS_CONFIG> = ["fail", "warn", "info", "pass"];

const HealthCheckList: React.FC<HealthCheckListProps> = ({
	checks,
	fixing,
	onFix,
	selectedGroup,
}) => {
	const { t } = useI18n();
	const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

	const filtered = selectedGroup ? checks.filter((c) => c.group === selectedGroup) : checks;

	const grouped = STATUS_ORDER.map((status) => ({
		status,
		checks: filtered.filter((c) => c.status === status),
	})).filter((g) => g.checks.length > 0);

	const toggleExpand = (id: string) => {
		setExpandedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	return (
		<div className="space-y-4">
			{grouped.map(({ status, checks: statusChecks }) => {
				const config = STATUS_CONFIG[status];
				return (
					<div key={status}>
						<div className="flex items-center gap-2 mb-2">
							<div className={`w-2 h-2 rounded-full ${config.dot}`} />
							<span className={`text-xs font-semibold uppercase tracking-wide ${config.color}`}>
								{t(config.label as Parameters<typeof t>[0])} ({statusChecks.length})
							</span>
							<div className="flex-1 h-px bg-dash-border" />
						</div>
						<div className="space-y-1">
							{statusChecks.map((check) => {
								const isExpanded = expandedIds.has(check.id);
								const isFixing = fixing.has(check.id);

								return (
									<div
										key={check.id}
										className={`rounded-lg border transition-all ${config.bg} border-dash-border`}
									>
										<button
											type="button"
											onClick={() => toggleExpand(check.id)}
											className="w-full flex items-center gap-3 px-4 py-3 text-left"
										>
											<div className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dot}`} />
											<div className="flex-1 min-w-0">
												<div className="flex items-center gap-2">
													<span className="text-sm font-medium text-dash-text truncate">
														{check.name}
													</span>
													<span className="text-[10px] text-dash-text-muted bg-dash-surface px-1.5 py-0.5 rounded">
														{check.group}
													</span>
												</div>
												<p className="text-xs text-dash-text-secondary mt-0.5 truncate">
													{check.message}
												</p>
											</div>
											{check.autoFixable && (
												<HealthFixButton checkId={check.id} isFixing={isFixing} onFix={onFix} />
											)}
											<svg
												className={`w-4 h-4 text-dash-text-muted transition-transform ${
													isExpanded ? "rotate-180" : ""
												}`}
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
												strokeWidth={2}
											>
												<path d="M19 9l-7 7-7-7" />
											</svg>
										</button>

										{isExpanded && (check.details || check.suggestion) && (
											<div className="px-4 pb-3 pt-0 ml-7 space-y-2 border-t border-dash-border/50">
												{check.details && (
													<p className="text-xs text-dash-text-secondary mt-2">{check.details}</p>
												)}
												{check.suggestion && (
													<div className="text-xs bg-dash-surface rounded px-3 py-2 text-dash-text-muted">
														<span className="font-medium text-dash-text-secondary">
															{t("healthSuggestion")}:
														</span>{" "}
														{check.suggestion}
													</div>
												)}
											</div>
										)}
									</div>
								);
							})}
						</div>
					</div>
				);
			})}
		</div>
	);
};

export default HealthCheckList;
