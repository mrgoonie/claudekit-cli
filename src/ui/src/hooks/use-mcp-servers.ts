/**
 * Hook to fetch MCP server data from the multi-source discovery endpoint
 */
import { useCallback, useEffect, useState } from "react";

export interface McpServer {
	name: string;
	command: string;
	args: string[];
	env?: Record<string, string>;
	source: string;
	sourceLabel: string;
}

interface McpServersResponse {
	servers: McpServer[];
}

export function useMcpServers() {
	const [servers, setServers] = useState<McpServer[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const loadServers = useCallback(async () => {
		try {
			setLoading(true);
			setError(null);
			const res = await fetch("/api/mcp-servers");
			if (!res.ok) {
				throw new Error(`Failed to fetch MCP servers: ${res.status}`);
			}
			const data = (await res.json()) as McpServersResponse;
			setServers(data.servers ?? []);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load MCP servers");
			setServers([]);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		loadServers();
	}, [loadServers]);

	return { servers, loading, error, reload: loadServers };
}
