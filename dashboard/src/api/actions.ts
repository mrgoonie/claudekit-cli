const API_BASE = "";

export async function openTerminal(path: string): Promise<void> {
	const res = await fetch(`${API_BASE}/api/actions/terminal`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ path }),
	});
	const json = await res.json();
	if (!json.success) throw new Error(json.error);
}

export async function openEditor(path: string): Promise<void> {
	const res = await fetch(`${API_BASE}/api/actions/editor`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ path }),
	});
	const json = await res.json();
	if (!json.success) throw new Error(json.error);
}

export async function launchClaude(path: string): Promise<void> {
	const res = await fetch(`${API_BASE}/api/actions/claude`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ path }),
	});
	const json = await res.json();
	if (!json.success) throw new Error(json.error);
}

export async function executeCcsCommand(
	command: string,
	cwd?: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
	const res = await fetch(`${API_BASE}/api/actions/ccs`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ command, cwd }),
	});
	const json = await res.json();
	if (!json.success) throw new Error(json.error);
	return json.data;
}
