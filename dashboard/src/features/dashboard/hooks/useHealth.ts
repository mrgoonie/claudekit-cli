import { useState, useEffect, useCallback } from "react";
import { fetchHealth, type HealthStatus } from "@/api/health";

export function useHealth(projectId: string | null) {
	const [health, setHealth] = useState<HealthStatus | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		if (!projectId) {
			setHealth(null);
			setLoading(false);
			return;
		}
		setLoading(true);
		try {
			const data = await fetchHealth(projectId);
			setHealth(data);
			setError(null);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to load health");
		} finally {
			setLoading(false);
		}
	}, [projectId]);

	useEffect(() => {
		load();
	}, [load]);

	return { health, loading, error, reload: load };
}
