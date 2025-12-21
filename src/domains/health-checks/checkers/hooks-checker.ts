import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { PathResolver } from "@/shared/path-resolver.js";
import type { CheckResult } from "../types.js";
import { normalizePath } from "../utils/path-normalizer.js";
import { HOOK_EXTENSIONS } from "./shared.js";

/**
 * Check if hooks directory exists and contains hooks
 */
export async function checkHooksExist(projectDir: string): Promise<CheckResult> {
	const globalHooksDir = join(PathResolver.getGlobalKitDir(), "hooks");
	const projectHooksDir = join(projectDir, ".claude", "hooks");

	const globalExists = existsSync(globalHooksDir);
	const projectExists = existsSync(projectHooksDir);

	let hookCount = 0;
	const checkedFiles = new Set<string>();

	// Check global hooks directory
	if (globalExists) {
		const files = await readdir(globalHooksDir, { withFileTypes: false });
		const hooks = files.filter((f) => HOOK_EXTENSIONS.some((ext) => f.endsWith(ext)));

		// Add unique hooks with normalized path to avoid double-counting on case-insensitive FS
		hooks.forEach((hook) => {
			const fullPath = join(globalHooksDir, hook);
			checkedFiles.add(normalizePath(fullPath));
		});
	}

	// Check project hooks directory only if it's different from global (case-insensitive comparison)
	const normalizedGlobal = normalizePath(globalHooksDir);
	const normalizedProject = normalizePath(projectHooksDir);

	if (projectExists && normalizedProject !== normalizedGlobal) {
		const files = await readdir(projectHooksDir, { withFileTypes: false });
		const hooks = files.filter((f) => HOOK_EXTENSIONS.some((ext) => f.endsWith(ext)));

		// Add unique hooks with normalized path
		hooks.forEach((hook) => {
			const fullPath = join(projectHooksDir, hook);
			checkedFiles.add(normalizePath(fullPath));
		});
	}

	hookCount = checkedFiles.size;

	if (!globalExists && !projectExists) {
		return {
			id: "ck-hooks-exist",
			name: "Hooks Directory",
			group: "claudekit",
			priority: "standard",
			status: "info",
			message: "No hooks directory",
			autoFixable: false,
		};
	}

	return {
		id: "ck-hooks-exist",
		name: "Hooks Directory",
		group: "claudekit",
		priority: "standard",
		status: "pass",
		message: `${hookCount} hook(s) found`,
		details: globalExists ? globalHooksDir : projectHooksDir,
		autoFixable: false,
	};
}
