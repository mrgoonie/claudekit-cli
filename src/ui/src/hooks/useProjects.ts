import * as api from "@/services/api";
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
			const data = await api.fetchProjects();
			setProjects(data);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load projects");
		} finally {
			setLoading(false);
		}
	}, []);

	const addProject = useCallback(
		async (request: api.AddProjectRequest): Promise<Project> => {
			const project = await api.addProject(request);
			await loadProjects(); // Reload to get fresh list
			return project;
		},
		[loadProjects],
	);

	const removeProject = useCallback(
		async (id: string): Promise<void> => {
			await api.removeProject(id);
			await loadProjects(); // Reload to get fresh list
		},
		[loadProjects],
	);

	const updateProject = useCallback(
		async (id: string, updates: api.UpdateProjectRequest): Promise<Project> => {
			const project = await api.updateProject(id, updates);
			await loadProjects(); // Reload to get fresh list
			return project;
		},
		[loadProjects],
	);

	useEffect(() => {
		loadProjects();
	}, [loadProjects]);

	return {
		projects,
		loading,
		error,
		reload: loadProjects,
		addProject,
		removeProject,
		updateProject,
	};
}
