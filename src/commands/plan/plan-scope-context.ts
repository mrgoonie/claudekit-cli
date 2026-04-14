import { isAbsolute, resolve } from "node:path";
import { CkConfigManager } from "@/domains/config/index.js";
import { resolveGlobalPlansDir } from "@/domains/plan-parser/index.js";
import { isWithinDir } from "@/domains/plan-parser/plan-scope.js";
import { findProjectRoot } from "@/domains/plan-parser/plans-registry.js";

export async function getGlobalPlansDirFromCwd(): Promise<string> {
	const projectRoot = findProjectRoot(process.cwd());
	// Intentionally uses merged config so a project can opt into a custom
	// global plans root while still defaulting to the user-level setting.
	const { config } = await CkConfigManager.loadFull(projectRoot);
	return resolveGlobalPlansDir(config);
}

export function resolveTargetFromBase(target: string, baseDir: string): string | null {
	const resolvedTarget = isAbsolute(target) ? resolve(target) : resolve(baseDir, target);
	return isWithinDir(resolvedTarget, baseDir) ? resolvedTarget : null;
}
