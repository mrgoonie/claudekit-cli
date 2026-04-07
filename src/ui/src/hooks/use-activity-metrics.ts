/**
 * useActivityMetrics — fetches cross-project session activity from the backend.
 *
 * Calls GET /api/sessions/activity?period={period}
 * Refreshes automatically when period changes.
 */

import { useCallback, useEffect, useState } from "react";

export type ActivityPeriod = "24h" | "7d" | "30d";

export interface ProjectActivityItem {
	name: string;
	path: string;
	sessionCount: number;
	lastActive: string | null;
}

export interface DailyCount {
	date: string;
	count: number;
}

export interface ActivityMetrics {
	totalSessions: number;
	projects: ProjectActivityItem[];
	dailyCounts: DailyCount[];
}

interface UseActivityMetricsResult {
	data: ActivityMetrics | null;
	loading: boolean;
	error: string | null;
	reload: () => void;
}

export function useActivityMetrics(period: ActivityPeriod): UseActivityMetricsResult {
	const [data, setData] = useState<ActivityMetrics | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const res = await fetch(`/api/sessions/activity?period=${encodeURIComponent(period)}`);
			if (!res.ok) {
				const body = (await res.json().catch(() => ({ error: "Request failed" }))) as {
					error?: string;
				};
				throw new Error(body.error ?? "Failed to load activity metrics");
			}
			const json = (await res.json()) as ActivityMetrics;
			setData(json);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load activity metrics");
			setData(null);
		} finally {
			setLoading(false);
		}
	}, [period]);

	useEffect(() => {
		void load();
	}, [load]);

	return { data, loading, error, reload: load };
}
