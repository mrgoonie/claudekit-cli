/**
 * Expandable health check list grouped by status with visual hierarchy
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
	fail: {
		label: "healthFailed",
		color: "text-red-500",
		dot: "bg-red-500",
		border: "border-red-500/20",
	},
	warn: {
		label: "healthWarnings",
		color: "text-amber-500",
		dot: "bg-amber-500",
		border: "border-amber-500/20",
	},
	pass: {
		label: "healthPassed",
		color: "text-emerald-500",
		dot: "bg-emerald-500",
		border: "border-emerald-500/20",
	},
	info: {
		label: "healthInfo",
		color: "text-blue-500",
		dot: "bg-blue-500",
		border: "border-blue-500/20",
	},
} as const;

const STATUS_ORDER: Array<keyof typeof STATUS_CONFIG> = ["fail", "warn", "info", "pass"];

/** All-pass celebration when zero failures/warnings */
function AllPassedState() {
	const { t } = useI18n();
	return (
		<div className="flex flex-col items-center justify-center py-12 text-center">
			<div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
				<svg
					className="w-7 h-7 text-emerald-500"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					strokeWidth={2}
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
			</div>
			<p className="text-sm font-semibold text-emerald-500">{t("healthAllPassed")}</p>
			<p className="text-xs text-dash-text-muted mt-1 max-w-xs">{t("healthAllPassedDesc")}</p>
		</div>
	);
}

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

	const hasIssues = filtered.some((c) => c.status === "fail" || c.status === "warn");
	if (!hasIssues && filtered.every((c) => c.status === "pass")) return <AllPassedState />;

	const toggleExpand = (id: string) => {
		setExpandedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	return (
		<div className="space-y-5">
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
						<div className="space-y-1.5">
							{statusChecks.map((check) => (
								<CheckItem
									key={check.id}
									check={check}
									config={config}
									isExpanded={expandedIds.has(check.id)}
									isFixing={fixing.has(check.id)}
									onToggle={() => toggleExpand(check.id)}
									onFix={onFix}
								/>
							))}
						</div>
					</div>
				);
			})}
		</div>
	);
};

/** Single check row with expand/collapse */
function CheckItem({
	check,
	config,
	isExpanded,
	isFixing,
	onToggle,
	onFix,
}: {
	check: CheckResultResponse;
	config: (typeof STATUS_CONFIG)[keyof typeof STATUS_CONFIG];
	isExpanded: boolean;
	isFixing: boolean;
	onToggle: () => void;
	onFix: (ids: string[]) => void;
}) {
	const { t } = useI18n();
	return (
		<div
			className={`rounded-lg border transition-all ${isExpanded ? config.border : "border-dash-border"} bg-dash-surface`}
		>
			<button
				type="button"
				onClick={onToggle}
				className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-dash-surface-hover transition-colors rounded-lg"
			>
				<div className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dot}`} />
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2">
						<span className="text-sm font-medium text-dash-text truncate">{check.name}</span>
						<span className="text-[10px] text-dash-text-muted bg-dash-bg px-1.5 py-0.5 rounded font-mono">
							{check.group}
						</span>
					</div>
					<p className="text-xs text-dash-text-secondary mt-0.5 truncate">{check.message}</p>
				</div>
				{check.autoFixable && (
					<HealthFixButton checkId={check.id} isFixing={isFixing} onFix={onFix} />
				)}
				<svg
					className={`w-4 h-4 text-dash-text-muted shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					strokeWidth={2}
				>
					<path d="M19 9l-7 7-7-7" />
				</svg>
			</button>
			{isExpanded && (check.details || check.suggestion) && (
				<div className="px-4 pb-3 ml-7 space-y-2 border-t border-dash-border/50">
					{check.details && (
						<p className="text-xs text-dash-text-secondary mt-2 whitespace-pre-wrap">
							{check.details}
						</p>
					)}
					{check.suggestion && (
						<div className="text-xs bg-dash-bg rounded-md px-3 py-2.5 text-dash-text-muted border border-dash-border-subtle">
							<span className="font-semibold text-dash-text-secondary">
								{t("healthSuggestion")}:
							</span>{" "}
							{check.suggestion}
						</div>
					)}
				</div>
			)}
		</div>
	);
}

export default HealthCheckList;
