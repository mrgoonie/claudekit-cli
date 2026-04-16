/**
 * Hook that aggregates entity counts for sidebar badges.
 * Fetches a single GET /api/dashboard/stats instead of 4 parallel requests.
 */
import { useEffect, useState } from "react";
import { fetchDashboardStats } from "../services/api";

export interface EntityCounts {
	agents: number;
	commands: number;
	skills: number;
	mcpServers: number;
}

interface DashboardStatsResponse {
	agents: number;
	commands: number;
	skills: number;
	mcpServers: number;
}

export function useEntityCounts() {
	const [counts, setCounts] = useState<EntityCounts | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;

		async function load() {
			setLoading(true);
			setError(null);
			try {
				const data = (await fetchDashboardStats()) as DashboardStatsResponse;

				if (cancelled) return;

				setCounts({
					agents: data.agents ?? 0,
					commands: data.commands ?? 0,
					skills: data.skills ?? 0,
					mcpServers: data.mcpServers ?? 0,
				});
			} catch (err) {
				if (cancelled) return;
				setError(err instanceof Error ? err.message : "Failed to load counts");
			} finally {
				if (!cancelled) setLoading(false);
			}
		}

		void load();

		return () => {
			cancelled = true;
		};
	}, []);

	return { counts, loading, error };
}
