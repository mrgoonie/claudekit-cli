const API_BASE = "";

export interface Project {
	id: string;
	path: string;
	name: string;
	addedAt: string;
}

export interface ProjectSuggestion {
	path: string;
	name: string;
	lastUsed: string;
}

export async function fetchProjects(): Promise<Project[]> {
	const res = await fetch(`${API_BASE}/api/projects`);
	if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
	const json = await res.json();
	if (!json.success) throw new Error(json.error);
	return json.data.projects;
}

export async function addProject(path: string, name?: string): Promise<Project> {
	const res = await fetch(`${API_BASE}/api/projects`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ path, name }),
	});
	if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
	const json = await res.json();
	if (!json.success) throw new Error(json.error);
	return json.data.project;
}

export async function removeProject(id: string): Promise<void> {
	const res = await fetch(`${API_BASE}/api/projects/${encodeURIComponent(id)}`, {
		method: "DELETE",
	});
	if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
	const json = await res.json();
	if (!json.success) throw new Error(json.error);
}

export async function fetchSuggestions(): Promise<ProjectSuggestion[]> {
	const res = await fetch(`${API_BASE}/api/projects/suggestions`);
	if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
	const json = await res.json();
	if (!json.success) throw new Error(json.error);
	return json.data.suggestions;
}
