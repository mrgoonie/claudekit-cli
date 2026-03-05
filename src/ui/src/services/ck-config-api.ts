/**
 * CK Config API client - Fetches and saves full .ck.json configuration
 */

import type { ConfigSource } from "../components/schema-form";

const API_BASE = "/api";

export interface CkConfigResponse {
	config: Record<string, unknown>;
	sources: Record<string, ConfigSource>;
	globalPath: string;
	projectPath: string | null;
}

export interface CkConfigSaveRequest {
	scope: "global" | "project";
	projectId?: string;
	config: Record<string, unknown>;
}

export interface CkConfigSaveResponse {
	success: boolean;
	path: string;
	scope: string;
}

/**
 * Fetch full .ck.json config with source tracking
 */
export async function fetchCkConfig(projectId?: string): Promise<CkConfigResponse> {
	const url = projectId
		? `${API_BASE}/ck-config?projectId=${encodeURIComponent(projectId)}`
		: `${API_BASE}/ck-config`;

	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`Failed to fetch ck-config: ${res.status}`);
	}
	return res.json();
}

/**
 * Fetch config for a specific scope only (no merge)
 */
export async function fetchCkConfigScope(
	scope: "global" | "project",
	projectId?: string,
): Promise<CkConfigResponse> {
	const params = new URLSearchParams({ scope });
	if (projectId) {
		params.set("projectId", projectId);
	}

	const res = await fetch(`${API_BASE}/ck-config?${params}`);
	if (!res.ok) {
		throw new Error(`Failed to fetch ck-config: ${res.status}`);
	}
	return res.json();
}

/**
 * Save .ck.json config to specified scope
 */
export async function saveCkConfig(request: CkConfigSaveRequest): Promise<CkConfigSaveResponse> {
	const res = await fetch(`${API_BASE}/ck-config`, {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(request),
	});

	if (!res.ok) {
		const error = await res.json().catch(() => ({ error: "Unknown error" }));
		throw new Error(error.error || `Failed to save ck-config: ${res.status}`);
	}

	return res.json();
}

/**
 * Fetch the JSON Schema for .ck.json
 */
export async function fetchCkConfigSchema(): Promise<Record<string, unknown>> {
	const res = await fetch(`${API_BASE}/ck-config/schema`);
	if (!res.ok) {
		throw new Error(`Failed to fetch schema: ${res.status}`);
	}
	return res.json();
}

/**
 * Update a single field at the specified scope
 */
export async function updateCkConfigField(
	fieldPath: string,
	value: unknown,
	scope: "global" | "project",
	projectId?: string,
): Promise<void> {
	const res = await fetch(`${API_BASE}/ck-config/field`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ scope, projectId, fieldPath, value }),
	});

	if (!res.ok) {
		const error = await res.json().catch(() => ({ error: "Unknown error" }));
		throw new Error(error.error || `Failed to update field: ${res.status}`);
	}
}
