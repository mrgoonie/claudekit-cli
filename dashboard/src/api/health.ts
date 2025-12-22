const API_BASE = "";

export interface HealthStatus {
	status: "healthy" | "warning" | "error";
	configIssues: Array<{ level: "warning" | "error"; message: string }>;
	versionInfo: {
		current: string;
		latest: string;
		updateAvailable: boolean;
	} | null;
}

export async function fetchHealth(projectId?: string): Promise<HealthStatus> {
	const url = projectId
		? `${API_BASE}/api/health/${encodeURIComponent(projectId)}`
		: `${API_BASE}/api/health`;
	const res = await fetch(url);
	if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
	const json = await res.json();
	if (!json.success) throw new Error(json.error);
	return json.data;
}
