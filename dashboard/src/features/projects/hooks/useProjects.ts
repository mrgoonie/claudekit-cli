import { useState, useEffect, useCallback } from "react";
import {
	fetchProjects,
	addProject,
	removeProject,
	fetchSuggestions,
	type Project,
	type ProjectSuggestion,
} from "../../../api/projects";

export function useProjects() {
	const [projects, setProjects] = useState<Project[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const loadProjects = useCallback(async () => {
		setLoading(true);
		try {
			const data = await fetchProjects();
			setProjects(data);
			setError(null);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to load");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		loadProjects();
	}, [loadProjects]);

	const add = async (path: string, name?: string) => {
		const project = await addProject(path, name);
		setProjects((prev) => [...prev, project]);
		return project;
	};

	const remove = async (id: string) => {
		await removeProject(id);
		setProjects((prev) => prev.filter((p) => p.id !== id));
	};

	return { projects, loading, error, add, remove, reload: loadProjects };
}

export function useSuggestions() {
	const [suggestions, setSuggestions] = useState<ProjectSuggestion[]>([]);
	const [loading, setLoading] = useState(false);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const data = await fetchSuggestions();
			setSuggestions(data);
		} catch {
			// Ignore suggestion load errors silently
		} finally {
			setLoading(false);
		}
	}, []);

	return { suggestions, loading, load };
}
