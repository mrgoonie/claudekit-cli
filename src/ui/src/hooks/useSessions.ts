import { fetchSessions } from "@/services/api";
import type { Session } from "@/types";
import { useCallback, useEffect, useState } from "react";

export function useSessions(projectId: string | null) {
	const [sessions, setSessions] = useState<Session[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [showAll, setShowAll] = useState(false);

	const loadSessions = useCallback(async () => {
		if (!projectId) {
			setSessions([]);
			return;
		}

		try {
			setLoading(true);
			setError(null);
			// limit=0 omitted means default (10), limit=999 means all
			const data = await fetchSessions(projectId, showAll ? 999 : undefined);
			setSessions(data);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load sessions");
		} finally {
			setLoading(false);
		}
	}, [projectId, showAll]);

	useEffect(() => {
		loadSessions();
	}, [loadSessions]);

	return { sessions, loading, error, reload: loadSessions, showAll, setShowAll };
}
