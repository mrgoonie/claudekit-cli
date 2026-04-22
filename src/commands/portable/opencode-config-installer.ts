/**
 * OpenCode config installer — ensures opencode.json has a `model` set so migrated
 * agents can resolve a provider. Without a global model, OpenCode throws
 * `ProviderModelNotFoundError` on every agent invocation (#728).
 *
 * Writes to the minimal location: global at `~/.config/opencode/opencode.json`,
 * project at `<cwd>/opencode.json`. Preserves any existing fields; only fills in
 * `model` when missing.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { logger } from "@/shared/logger.js";
import { resolveOpenCodeDefaultModel } from "./model-taxonomy.js";

export interface EnsureOpenCodeModelResult {
	path: string;
	action: "added" | "existing" | "created";
	model: string;
}

function getOpenCodeConfigPath(global: boolean): string {
	if (global) {
		return join(homedir(), ".config", "opencode", "opencode.json");
	}
	return join(process.cwd(), "opencode.json");
}

/**
 * Ensure opencode.json has a `model` field. Returns the action taken.
 * - "existing": file already had a model, nothing changed
 * - "added": file existed but lacked model, field inserted
 * - "created": file did not exist, minimal config written
 */
export async function ensureOpenCodeModel(options: {
	global: boolean;
}): Promise<EnsureOpenCodeModelResult> {
	const configPath = getOpenCodeConfigPath(options.global);
	const defaultModel = resolveOpenCodeDefaultModel();

	let existing: Record<string, unknown> | null = null;
	try {
		const raw = await readFile(configPath, "utf-8");
		const parsed = JSON.parse(raw) as unknown;
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
			existing = parsed as Record<string, unknown>;
		}
	} catch (err) {
		const errno = (err as NodeJS.ErrnoException | null)?.code;
		if (errno && errno !== "ENOENT") {
			logger.verbose(`ensureOpenCodeModel: failed to read ${configPath} (${errno}); recreating`);
		}
	}

	if (existing && typeof existing.model === "string" && existing.model.trim().length > 0) {
		return { path: configPath, action: "existing", model: existing.model };
	}

	const next = { ...(existing ?? {}), model: defaultModel };
	await mkdir(dirname(configPath), { recursive: true });
	await writeFile(configPath, `${JSON.stringify(next, null, 2)}\n`, "utf-8");

	return {
		path: configPath,
		action: existing ? "added" : "created",
		model: defaultModel,
	};
}
