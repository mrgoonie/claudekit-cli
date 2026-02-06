/**
 * SystemInsightsCard - User insights widget showing projects and sessions stats
 */
import type React from "react";
import { useEffect, useState } from "react";
import { useI18n } from "../i18n";

interface UserInsights {
	totalProjects: number;
	totalSessions: number;
	mostUsedProject: string | null;
	mostRecentProject: string | null;
	mostRecentProjectTimestamp?: string;
}

const SystemInsightsCard: React.FC = () => {
	const { t } = useI18n();
	const [insights, setInsights] = useState<UserInsights | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		fetch("/api/user/insights")
			.then((res) => res.json())
			.then(setInsights)
			.catch(() => setInsights(null))
			.finally(() => setLoading(false));
	}, []);

	if (loading) {
		return (
			<div className="bg-dash-bg border border-dash-border rounded-lg p-5">
				<div className="animate-pulse">
					<div className="h-5 bg-dash-border rounded w-32 mb-3" />
					<div className="grid grid-cols-2 gap-x-6 gap-y-2">
						<div className="h-4 bg-dash-border rounded" />
						<div className="h-4 bg-dash-border rounded" />
						<div className="h-4 bg-dash-border rounded" />
						<div className="h-4 bg-dash-border rounded" />
					</div>
				</div>
			</div>
		);
	}

	if (!insights) {
		return null;
	}

	const formatRelativeTime = (timestamp?: string): string => {
		if (!timestamp) return "—";
		const date = new Date(timestamp);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return "just now";
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		return `${diffDays}d ago`;
	};

	return (
		<div className="bg-dash-bg border border-dash-border rounded-lg p-5">
			<h3 className="text-base font-bold text-dash-text mb-3">{t("insightsCardTitle")}</h3>
			<div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
				<InfoItem label={t("totalProjects")} value={String(insights.totalProjects)} />
				<InfoItem label={t("totalSessions")} value={String(insights.totalSessions)} />
				<InfoItem label={t("mostUsedProject")} value={insights.mostUsedProject ?? "—"} />
				<InfoItem
					label={t("mostRecentProject")}
					value={insights.mostRecentProject ?? "—"}
					sublabel={formatRelativeTime(insights.mostRecentProjectTimestamp)}
				/>
			</div>
		</div>
	);
};

const InfoItem: React.FC<{
	label: string;
	value: string;
	sublabel?: string;
}> = ({ label, value, sublabel }) => (
	<div>
		<span className="text-dash-text-muted text-xs">{label}: </span>
		<span className="text-dash-text-secondary">{value}</span>
		{sublabel && <span className="text-dash-text-muted text-xs ml-1">({sublabel})</span>}
	</div>
);

export default SystemInsightsCard;
