const API_BASE = "";

export interface TracedValue {
	value: unknown;
	source: "DEFAULT" | "GLOBAL" | "LOCAL";
	path: string;
}

export interface ConfigResponse {
	merged: Record<string, unknown>;
	traced: Record<string, TracedValue>;
	sources: {
		default: Record<string, unknown>;
		global: Record<string, unknown> | null;
		local: Record<string, unknown> | null;
	};
	paths: {
		global: string;
		local: string;
	};
}

export interface SchemaResponse {
	$schema: string;
	title: string;
	type: string;
	properties: Record<string, unknown>;
}

export async function fetchConfig(): Promise<ConfigResponse> {
	const res = await fetch(`${API_BASE}/api/config`);
	const json = await res.json();
	if (!json.success) throw new Error(json.error);
	return json.data;
}

export async function saveConfig(
	scope: "global" | "local",
	config: Record<string, unknown>,
): Promise<{ path: string; backupPath: string | null }> {
	const res = await fetch(`${API_BASE}/api/config`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ scope, config }),
	});
	const json = await res.json();
	if (!json.success) throw new Error(json.error);
	return json.data;
}

export async function fetchSchema(): Promise<SchemaResponse> {
	const res = await fetch(`${API_BASE}/api/schema`);
	const json = await res.json();
	if (!json.success) throw new Error(json.error);
	return json.data;
}

export async function validateConfig(
	config: Record<string, unknown>,
): Promise<{ valid: boolean; errors?: Array<{ path: string; message: string }> }> {
	const res = await fetch(`${API_BASE}/api/validate`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ config }),
	});
	const json = await res.json();
	if (!json.success) throw new Error(json.error);
	return json.data;
}

export async function fetchBackups(scope: "global" | "local"): Promise<string[]> {
	const res = await fetch(`${API_BASE}/api/backups?scope=${scope}`);
	const json = await res.json();
	if (!json.success) throw new Error(json.error);
	return json.data.backups;
}

export async function restoreBackup(
	scope: "global" | "local",
	filename: string,
): Promise<void> {
	const res = await fetch(`${API_BASE}/api/restore`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ scope, filename }),
	});
	const json = await res.json();
	if (!json.success) throw new Error(json.error);
}
