const API_BASE = "";

export interface Skill {
	id: string;
	name: string;
	description: string;
	path: string;
}

export async function fetchSkills(): Promise<Skill[]> {
	const res = await fetch(`${API_BASE}/api/skills`);
	if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
	const json = await res.json();
	if (!json.success) throw new Error(json.error);
	return json.data.skills;
}
