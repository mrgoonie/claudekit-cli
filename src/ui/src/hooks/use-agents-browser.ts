/**
 * Hook for fetching agents browser list from /api/agents/browser
 */
import * as tauri from "@/lib/tauri-commands";
import { useCallback, useEffect, useState } from "react";
import { isTauri } from "./use-tauri";

export interface AgentListItem {
	slug: string;
	name: string;
	description: string;
	model: string | null;
	color: string | null;
	skillCount: number;
	dirLabel: string;
	relativePath: string;
}

export interface AgentDetail extends AgentListItem {
	frontmatter: Record<string, unknown>;
	body: string;
}

interface AgentsListResponse {
	agents: AgentListItem[];
	total: number;
}

export function useAgentsBrowser() {
	const [agents, setAgents] = useState<AgentListItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		try {
			setLoading(true);
			setError(null);
			if (isTauri()) {
				const data = await tauri.scanAgents();
				setAgents(
					data.map((agent) => ({
						...agent,
						model: agent.model ?? null,
						color: agent.color ?? null,
					})),
				);
				return;
			}
			const res = await fetch("/api/agents/browser");
			if (!res.ok) throw new Error(`Request failed: ${res.status}`);
			const data: AgentsListResponse = await res.json();
			setAgents(data.agents);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load agents");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	return { agents, loading, error, reload: load };
}

export function useAgentDetail(slug: string | undefined) {
	const [agent, setAgent] = useState<AgentDetail | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		if (!slug) return;
		try {
			setLoading(true);
			setError(null);
			if (isTauri()) {
				const data = await tauri.getAgentDetail(slug);
				setAgent({
					...data,
					model: data.model ?? null,
					color: data.color ?? null,
					frontmatter: data.frontmatter,
					body: data.body,
				});
				return;
			}
			const res = await fetch(`/api/agents/browser/${encodeURIComponent(slug)}`);
			if (res.status === 404) throw new Error("Agent not found");
			if (!res.ok) throw new Error(`Request failed: ${res.status}`);
			const data: AgentDetail = await res.json();
			setAgent(data);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load agent");
		} finally {
			setLoading(false);
		}
	}, [slug]);

	useEffect(() => {
		void load();
	}, [load]);

	return { agent, loading, error };
}
