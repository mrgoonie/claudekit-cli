/**
 * Hook for fetching dashboard stats, recent agents, and suggestions
 */
import { useCallback, useEffect, useState } from "react";

export interface DashboardStats {
	agents: number;
	commands: number;
	skills: number;
	mcpServers: number;
	modelDistribution: {
		opus: number;
		sonnet: number;
		haiku: number;
		unset: number;
	};
}

export interface DashboardAgent {
	name: string;
	model: string;
	description: string;
	color?: string;
}

export interface DashboardSuggestion {
	type: "warning" | "info" | "success";
	message: string;
	target?: string;
}

const API_BASE = "/api";

async function fetchDashboardStats(): Promise<DashboardStats> {
	const res = await fetch(`${API_BASE}/dashboard/stats`);
	if (!res.ok) throw new Error("Failed to fetch dashboard stats");
	return res.json() as Promise<DashboardStats>;
}

async function fetchRecentAgents(): Promise<DashboardAgent[]> {
	const res = await fetch(`${API_BASE}/agents/list`);
	if (!res.ok) throw new Error("Failed to fetch agents");
	const data = (await res.json()) as { agents: DashboardAgent[] };
	return data.agents;
}

async function fetchSuggestions(): Promise<DashboardSuggestion[]> {
	const res = await fetch(`${API_BASE}/suggestions`);
	if (!res.ok) throw new Error("Failed to fetch suggestions");
	const data = (await res.json()) as { suggestions: DashboardSuggestion[] };
	return data.suggestions;
}

export function useDashboardData() {
	const [stats, setStats] = useState<DashboardStats | null>(null);
	const [agents, setAgents] = useState<DashboardAgent[]>([]);
	const [suggestions, setSuggestions] = useState<DashboardSuggestion[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const [statsData, agentsData, suggestionsData] = await Promise.all([
				fetchDashboardStats(),
				fetchRecentAgents(),
				fetchSuggestions(),
			]);
			setStats(statsData);
			setAgents(agentsData);
			setSuggestions(suggestionsData);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load dashboard");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	return { stats, agents, suggestions, loading, error, reload: load };
}
