const API_BASE = "";

export interface Session {
	id: string;
	summary: string;
	timestamp: string;
	duration?: number; // minutes
}

export async function fetchSessions(
	projectId: string,
	limit = 5,
): Promise<Session[]> {
	const res = await fetch(
		`${API_BASE}/api/sessions/${encodeURIComponent(projectId)}?limit=${limit}`,
	);
	if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
	const json = await res.json();
	if (!json.success) throw new Error(json.error);
	return json.data.sessions;
}
