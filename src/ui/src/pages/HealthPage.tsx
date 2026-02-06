/**
 * Health dashboard page - system health checks with auto-fix
 */
import type React from "react";
import { useMemo, useState } from "react";
import HealthCheckList from "../components/health/health-check-list";
import HealthStatusCards from "../components/health/health-status-cards";
import { useDoctor } from "../hooks/useDoctor";
import { useI18n } from "../i18n";

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

	const handleFixAll = () => {
		if (!summary) return;
		const fixableIds = summary.checks
			.filter((c) => c.autoFixable && (c.status === "fail" || c.status === "warn"))
			.map((c) => c.id);
		if (fixableIds.length > 0) fixCheck(fixableIds);
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center h-full">
				<div className="text-center">
					<div className="w-8 h-8 border-4 border-dash-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
					<p className="text-dash-text-muted">{t("healthLoading")}</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex items-center justify-center h-full">
				<div className="text-center max-w-md">
					<p className="text-red-500 mb-3">{error}</p>
					<button
						type="button"
						onClick={() => runChecks()}
						className="px-4 py-2 bg-dash-accent text-white rounded-md hover:bg-dash-accent/90"
					>
						{t("tryAgain")}
					</button>
				</div>
			</div>
		);
	}

	if (!summary) return null;

	return (
		<div className="h-full flex flex-col">
			{/* Header */}
			<div className="border-b border-dash-border bg-dash-surface px-8 py-5">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-xl font-bold text-dash-text">{t("healthTitle")}</h1>
						<p className="text-sm text-dash-text-muted mt-0.5">{t("healthSubtitle")}</p>
					</div>
					<div className="flex items-center gap-3">
						{/* Overall score */}
						<div className="text-center mr-4">
							<div
								className={`text-2xl font-bold ${
									summary.failed > 0
										? "text-red-500"
										: summary.warnings > 0
											? "text-amber-500"
											: "text-emerald-500"
								}`}
							>
								{summary.passed}/{summary.total}
							</div>
							<div className="text-[11px] text-dash-text-muted uppercase tracking-wide">
								{t("healthPassed")}
							</div>
						</div>

						{/* Fix All button */}
						{fixableCount > 0 && (
							<button
								type="button"
								onClick={handleFixAll}
								disabled={fixing.size > 0}
								className="px-3 py-1.5 bg-dash-accent text-white rounded-md text-xs font-semibold hover:bg-dash-accent/90 transition-colors disabled:opacity-50"
							>
								{fixing.size > 0
									? t("healthFixing")
									: t("healthFixAll").replace("{count}", String(fixableCount))}
							</button>
						)}

						{/* Re-run button */}
						<button
							type="button"
							onClick={() => runChecks()}
							className="px-3 py-1.5 border border-dash-border text-dash-text-secondary rounded-md text-xs font-medium hover:bg-dash-surface-hover transition-colors"
						>
							{t("healthRerun")}
						</button>
					</div>
				</div>
			</div>

			{/* Content */}
			<div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
				{/* Group cards */}
				<HealthStatusCards
					summary={summary}
					selectedGroup={selectedGroup}
					onSelectGroup={setSelectedGroup}
				/>

				{/* Check list */}
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
