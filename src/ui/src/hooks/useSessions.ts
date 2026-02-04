import { fetchSessions } from "@/services/api";
import type { Session } from "@/types";
import { useCallback, useEffect, useState } from "react";

export function useSessions(projectId: string | null) {
	const [sessions, setSessions] = useState<Session[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const loadSessions = useCallback(async () => {
		if (!projectId) {
			setSessions([]);
			return;
		}

		try {
			setLoading(true);
			setError(null);
			// Fetch all sessions (no limit)
			const data = await fetchSessions(projectId, 999);
			setSessions(data);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load sessions");
		} finally {
			setLoading(false);
		}
	}, [projectId]);

	useEffect(() => {
		loadSessions();
	}, [loadSessions]);

	return { sessions, loading, error, reload: loadSessions };
}
