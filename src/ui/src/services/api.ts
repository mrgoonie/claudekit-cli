const API_BASE = "/api";

export async function fetchConfig(): Promise<{
	global: Record<string, unknown>;
	local: Record<string, unknown> | null;
	merged: Record<string, unknown>;
}> {
	const res = await fetch(`${API_BASE}/config`);
	if (!res.ok) throw new Error("Failed to fetch config");
	return res.json();
}

export async function saveConfig(
	scope: "global" | "local",
	config: Record<string, unknown>,
): Promise<void> {
	const res = await fetch(`${API_BASE}/config`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ scope, config }),
	});
	if (!res.ok) throw new Error("Failed to save config");
}

export async function fetchProjects(): Promise<
	Array<{
		id: string;
		name: string;
		path: string;
		hasLocalConfig: boolean;
		kitType: string | null;
		version: string | null;
	}>
> {
	const res = await fetch(`${API_BASE}/projects`);
	if (!res.ok) throw new Error("Failed to fetch projects");
	return res.json();
}

export async function checkHealth(): Promise<boolean> {
	try {
		const res = await fetch(`${API_BASE}/health`);
		return res.ok;
	} catch {
		return false;
	}
}
