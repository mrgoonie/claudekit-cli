/**
 * Hook that aggregates entity counts for sidebar badges.
 * Fetches agents, commands, skills, and MCP servers counts in parallel.
 */
import { useEffect, useState } from "react";

export interface EntityCounts {
	agents: number;
	commands: number;
	skills: number;
	mcpServers: number;
}

interface AgentsResponse {
	total: number;
}

interface CommandNode {
	children?: CommandNode[];
}

function countLeafNodes(nodes: CommandNode[]): number {
	let count = 0;
	for (const node of nodes) {
		if (node.children) {
			count += countLeafNodes(node.children);
		} else {
			count += 1;
		}
	}
	return count;
}

async function fetchAgentCount(): Promise<number> {
	const res = await fetch("/api/agents/browser");
	if (!res.ok) throw new Error(`Agents fetch failed: ${res.status}`);
	const data = (await res.json()) as AgentsResponse;
	return data.total ?? 0;
}

async function fetchCommandCount(): Promise<number> {
	const res = await fetch("/api/commands");
	if (!res.ok) throw new Error(`Commands fetch failed: ${res.status}`);
	const data = (await res.json()) as { tree: CommandNode[] };
	return countLeafNodes(data.tree ?? []);
}

async function fetchSkillCount(): Promise<number> {
	const res = await fetch("/api/skills/browse");
	if (!res.ok) throw new Error(`Skills fetch failed: ${res.status}`);
	const data = (await res.json()) as { skills: unknown[] };
	return (data.skills ?? []).length;
}

async function fetchMcpCount(): Promise<number> {
	const res = await fetch("/api/mcp-servers");
	if (!res.ok) throw new Error(`MCP fetch failed: ${res.status}`);
	const data = (await res.json()) as { servers: unknown[] };
	return (data.servers ?? []).length;
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
				const [agents, commands, skills, mcpServers] = await Promise.allSettled([
					fetchAgentCount(),
					fetchCommandCount(),
					fetchSkillCount(),
					fetchMcpCount(),
				]);

				if (cancelled) return;

				setCounts({
					agents: agents.status === "fulfilled" ? agents.value : 0,
					commands: commands.status === "fulfilled" ? commands.value : 0,
					skills: skills.status === "fulfilled" ? skills.value : 0,
					mcpServers: mcpServers.status === "fulfilled" ? mcpServers.value : 0,
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
