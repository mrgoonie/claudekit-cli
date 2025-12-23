import { fetchProjects } from "@/services/api";
import type { Project } from "@/types";
import { useCallback, useEffect, useState } from "react";

export function useProjects() {
	const [projects, setProjects] = useState<Project[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const loadProjects = useCallback(async () => {
		try {
			setLoading(true);
			setError(null);
			const data = await fetchProjects();
			setProjects(data);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load projects");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		loadProjects();
	}, [loadProjects]);

	return { projects, loading, error, reload: loadProjects };
}
