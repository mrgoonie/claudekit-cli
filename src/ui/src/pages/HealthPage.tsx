/**
 * Health dashboard page - system health checks with auto-fix
 */
import type React from "react";
import { useMemo, useState } from "react";
import HealthCheckList from "../components/health/health-check-list";
import HealthScoreRing from "../components/health/health-score-ring";
import HealthStatusCards from "../components/health/health-status-cards";
import { useDoctor } from "../hooks/useDoctor";
import { useI18n } from "../i18n";

/** Skeleton placeholder rows for loading state */
function HealthSkeleton() {
	return (
		<div className="h-full flex flex-col animate-pulse">
			<div className="border-b border-dash-border bg-dash-surface px-6 py-5 sm:px-8">
				<div className="flex items-center justify-between">
					<div className="space-y-2">
						<div className="h-5 w-36 bg-dash-border-subtle rounded" />
						<div className="h-3 w-52 bg-dash-border-subtle rounded" />
					</div>
					<div className="h-14 w-14 bg-dash-border-subtle rounded-full" />
				</div>
			</div>
			<div className="flex-1 px-6 py-6 sm:px-8 space-y-4">
				<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
					{Array.from({ length: 5 }).map((_, i) => (
						<div
							key={`skel-card-${i}`}
							className="h-24 bg-dash-surface rounded-lg border border-dash-border"
						/>
					))}
				</div>
				{Array.from({ length: 4 }).map((_, i) => (
					<div
						key={`skel-row-${i}`}
						className="h-14 bg-dash-surface rounded-lg border border-dash-border"
					/>
				))}
			</div>
		</div>
	);
}

/** Error state with retry */
function HealthError({ error, onRetry }: { error: string; onRetry: () => void }) {
	const { t } = useI18n();
	return (
		<div className="flex items-center justify-center h-full">
			<div className="text-center max-w-sm space-y-4">
				<div className="mx-auto w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
					<svg
						className="w-6 h-6 text-red-500"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						strokeWidth={1.5}
					>
						<path d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
					</svg>
				</div>
				<div>
					<p className="text-sm font-semibold text-dash-text">{t("healthErrorTitle")}</p>
					<p className="text-xs text-dash-text-muted mt-1">{error}</p>
				</div>
				<button
					type="button"
					onClick={onRetry}
					className="px-4 py-2 bg-dash-accent text-white rounded-lg text-sm font-medium hover:bg-dash-accent-hover transition-colors"
				>
					{t("healthRetry")}
				</button>
			</div>
		</div>
	);
}

const HealthPage: React.FC = () => {
	const { t } = useI18n();
	const { summary, loading, error, fixing, runChecks, fixCheck } = useDoctor();
	const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

	const fixableCount = useMemo(() => {
		if (!summary) return 0;
		return summary.checks.filter(
			(c) => c.autoFixable && (c.status === "fail" || c.status === "warn"),
		).length;
	}, [summary]);

	const scorePercent = useMemo(() => {
		if (!summary || summary.total === 0) return 0;
		return Math.round((summary.passed / summary.total) * 100);
	}, [summary]);

	const handleFixAll = () => {
		if (!summary) return;
		const fixableIds = summary.checks
			.filter((c) => c.autoFixable && (c.status === "fail" || c.status === "warn"))
			.map((c) => c.id);
		if (fixableIds.length > 0) fixCheck(fixableIds);
	};

	if (loading) return <HealthSkeleton />;
	if (error) return <HealthError error={error} onRetry={() => runChecks()} />;
	if (!summary) return null;

	return (
		<div className="h-full flex flex-col">
			{/* Header */}
			<div className="border-b border-dash-border bg-dash-surface px-6 py-5 sm:px-8">
				<div className="flex items-center justify-between gap-4">
					<div className="flex items-center gap-5 min-w-0">
						<HealthScoreRing
							percent={scorePercent}
							failed={summary.failed}
							warnings={summary.warnings}
						/>
						<div className="min-w-0">
							<h1 className="text-lg font-bold text-dash-text truncate">{t("healthTitle")}</h1>
							<p className="text-xs text-dash-text-muted mt-0.5 truncate">{t("healthSubtitle")}</p>
						</div>
					</div>
					<div className="flex items-center gap-2 shrink-0">
						{fixableCount > 0 && (
							<button
								type="button"
								onClick={handleFixAll}
								disabled={fixing.size > 0}
								className="px-3 py-1.5 bg-dash-accent text-white rounded-lg text-xs font-semibold hover:bg-dash-accent-hover transition-colors disabled:opacity-50"
							>
								{fixing.size > 0
									? t("healthFixing")
									: t("healthFixAll").replace("{count}", String(fixableCount))}
							</button>
						)}
						<button
							type="button"
							onClick={() => runChecks()}
							className="px-3 py-1.5 border border-dash-border text-dash-text-secondary rounded-lg text-xs font-medium hover:bg-dash-surface-hover transition-colors"
						>
							{t("healthRerun")}
						</button>
					</div>
				</div>
			</div>

			{/* Content */}
			<div className="flex-1 overflow-y-auto px-6 py-6 sm:px-8 space-y-6">
				<HealthStatusCards
					summary={summary}
					selectedGroup={selectedGroup}
					onSelectGroup={setSelectedGroup}
				/>
				<HealthCheckList
					checks={summary.checks}
					fixing={fixing}
					onFix={(ids) => fixCheck(ids)}
					selectedGroup={selectedGroup}
				/>
			</div>
		</div>
	);
};

export default HealthPage;
