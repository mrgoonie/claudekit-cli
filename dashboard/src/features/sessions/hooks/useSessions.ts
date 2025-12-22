import { useState, useEffect, useCallback } from "react";
import { fetchSessions, type Session } from "@/api/sessions";

export function useSessions(projectId: string | null) {
	const [sessions, setSessions] = useState<Session[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		if (!projectId) {
			setSessions([]);
			setLoading(false);
			return;
		}
		setLoading(true);
		try {
			const data = await fetchSessions(projectId);
			setSessions(data);
			setError(null);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to load sessions");
		} finally {
			setLoading(false);
		}
	}, [projectId]);

	useEffect(() => {
		load();
	}, [load]);

	return { sessions, loading, error, reload: load };
}
