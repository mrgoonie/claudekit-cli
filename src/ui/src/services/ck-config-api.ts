/**
 * CK Config API client - Fetches and saves full .ck.json configuration
 */

import { isTauri } from "@/hooks/use-tauri";
import * as tauri from "@/lib/tauri-commands";
import { fetchProject } from "@/services/api";
import { dirname, join } from "pathe";
import ckConfigSchema from "../../../schemas/ck-config.schema.json" with { type: "json" };
import { CkConfigSchema, normalizeCkConfigInput } from "../../../types/ck-config";
import type { ConfigSource } from "../components/schema-form";
import { setNestedValue } from "../utils/config-editor-utils";

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
	config: Record<string, unknown>;
}

function getConfigProjectRootFromGlobalDir(globalDir: string): string {
	return dirname(globalDir);
}

async function getDesktopConfigTarget(
	scope: "global" | "project",
	projectId?: string,
): Promise<{ projectRoot: string; path: string }> {
	if (scope === "global") {
		const globalDir = await tauri.getGlobalConfigDir();
		return {
			projectRoot: getConfigProjectRootFromGlobalDir(globalDir),
			path: join(globalDir, ".ck.json"),
		};
	}

	if (!projectId) {
		throw new Error("Project ID is required for project config");
	}

	const project = await fetchProject(projectId);
	return {
		projectRoot: project.path,
		path: join(project.path, ".claude", ".ck.json"),
	};
}

function buildSources(
	value: unknown,
	source: ConfigSource,
	prefix = "",
): Record<string, ConfigSource> {
	if (value === null || value === undefined) {
		return {};
	}

	if (Array.isArray(value)) {
		return prefix ? { [prefix]: source } : {};
	}

	if (typeof value !== "object") {
		return prefix ? { [prefix]: source } : {};
	}

	const entries = Object.entries(value as Record<string, unknown>);
	if (entries.length === 0) {
		return prefix ? { [prefix]: source } : {};
	}

	const acc: Record<string, ConfigSource> = {};
	for (const [key, nested] of entries) {
		const nextPrefix = prefix ? `${prefix}.${key}` : key;
		Object.assign(acc, buildSources(nested, source, nextPrefix));
	}
	return acc;
}

function deepMerge(
	target: Record<string, unknown>,
	source: Record<string, unknown>,
): Record<string, unknown> {
	const result = { ...target };

	for (const [key, sourceValue] of Object.entries(source)) {
		const targetValue = result[key];
		if (
			sourceValue &&
			typeof sourceValue === "object" &&
			!Array.isArray(sourceValue) &&
			targetValue &&
			typeof targetValue === "object" &&
			!Array.isArray(targetValue)
		) {
			result[key] = deepMerge(
				targetValue as Record<string, unknown>,
				sourceValue as Record<string, unknown>,
			);
			continue;
		}

		result[key] = sourceValue;
	}

	return result;
}

function validateDesktopConfig(config: Record<string, unknown>): Record<string, unknown> {
	const parsed = CkConfigSchema.safeParse(normalizeCkConfigInput(config));
	if (!parsed.success) {
		throw new Error(parsed.error.issues[0]?.message ?? "Config validation failed");
	}

	return parsed.data as Record<string, unknown>;
}

function buildValidatedDesktopPatch(fieldPath: string, value: unknown): Record<string, unknown> {
	const patch = setNestedValue({}, fieldPath, value);
	return validateDesktopConfig(patch);
}

async function readDesktopConfig(
	projectRoot: string,
	options?: { fallbackToEmpty?: boolean },
): Promise<Record<string, unknown>> {
	const raw = await tauri.readConfig(projectRoot);

	try {
		return validateDesktopConfig(raw);
	} catch (error) {
		if (options?.fallbackToEmpty) {
			// Use the raw (unvalidated) config instead of an empty object so the UI
			// still shows the user's actual values even when schema validation fails
			// due to schema drift (e.g. new hook keys not yet in CkHooksConfigSchema).
			console.warn("[ck-config-api] Config validation failed, using raw config as-is", error);
			return raw as Record<string, unknown>;
		}
		throw error;
	}
}

/**
 * Fetch full .ck.json config with source tracking
 */
export async function fetchCkConfig(projectId?: string): Promise<CkConfigResponse> {
	if (isTauri()) {
		const target = await getDesktopConfigTarget("global");
		const config = await readDesktopConfig(target.projectRoot, { fallbackToEmpty: true });
		return {
			config,
			sources: buildSources(config, "global"),
			globalPath: target.path,
			projectPath: null,
		};
	}

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
	if (isTauri()) {
		const target = await getDesktopConfigTarget(scope, projectId);
		const config = await readDesktopConfig(target.projectRoot, { fallbackToEmpty: true });
		return {
			config,
			sources: buildSources(config, scope),
			globalPath: scope === "global" ? target.path : "",
			projectPath: scope === "project" ? target.path : null,
		};
	}

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
	if (isTauri()) {
		const target = await getDesktopConfigTarget(request.scope, request.projectId);
		const existing = await readDesktopConfig(target.projectRoot, { fallbackToEmpty: true });
		const merged = deepMerge(existing, validateDesktopConfig(request.config));
		await tauri.writeConfig(target.projectRoot, merged);
		return {
			success: true,
			path: target.path,
			scope: request.scope,
			config: merged,
		};
	}

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
	if (isTauri()) {
		return ckConfigSchema as Record<string, unknown>;
	}

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
	if (isTauri()) {
		const target = await getDesktopConfigTarget(scope, projectId);
		const current = await readDesktopConfig(target.projectRoot, { fallbackToEmpty: true });
		const patch = buildValidatedDesktopPatch(fieldPath, value);
		const updated = deepMerge(current, patch);
		await tauri.writeConfig(target.projectRoot, updated);
		return;
	}

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
