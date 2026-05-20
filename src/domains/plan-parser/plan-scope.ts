import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import type { CkConfig } from "@/types";
import type { PlanScope } from "./plan-types.js";

const DEFAULT_PLANS_DIRNAME = "plans";
const GLOBAL_PLAN_PREFIX = "global:";
const PROJECT_PLAN_PREFIX = "project:";
const PLAN_ID_PATTERN = /^[A-Za-z0-9._-]+$/;

function resolveConfiguredDir(configuredPath: string | undefined, baseDir: string): string {
	const trimmed = configuredPath?.trim();
	if (!trimmed) {
		return join(baseDir, DEFAULT_PLANS_DIRNAME);
	}
	return isAbsolute(trimmed) ? resolve(trimmed) : resolve(baseDir, trimmed);
}

export function resolveProjectPlansDir(projectRoot: string, config?: CkConfig): string {
	return resolveConfiguredDir(config?.paths?.plans, projectRoot);
}

export function resolveGlobalPlansDir(config?: CkConfig): string {
	return resolveConfiguredDir(config?.paths?.globalPlans, join(homedir(), ".claude"));
}

export function resolvePlanDirForScope(
	scope: PlanScope,
	projectRoot: string,
	config?: CkConfig,
): string {
	return scope === "global"
		? resolveGlobalPlansDir(config)
		: resolveProjectPlansDir(projectRoot, config);
}

export function isWithinDir(targetPath: string, baseDir: string): boolean {
	const resolvedTarget = resolve(targetPath);
	const resolvedBase = resolve(baseDir);
	// This logical containment check is sufficient for CLI/domain path
	// resolution. For request-facing route validation, use the symlink-safe
	// realpath-based guard in plan-routes.ts (`isWithinBase`).
	const relativePath = relative(resolvedBase, resolvedTarget);
	return (
		relativePath === "" ||
		(!relativePath.startsWith("..") && relativePath !== ".." && !isAbsolute(relativePath))
	);
}

export function inferPlanScopeForDir(planDir: string, config?: CkConfig): PlanScope {
	return isWithinDir(planDir, resolveGlobalPlansDir(config)) ? "global" : "project";
}

export function parsePlanReference(
	reference: string,
	defaultScope: PlanScope,
): { scope: PlanScope; planId: string; valid: boolean } {
	const trimmed = reference.trim();
	const normalizePlanId = (rawPlanId: string) => {
		const planId = rawPlanId.trim();
		const valid =
			planId.length > 0 &&
			!isAbsolute(planId) &&
			!planId.includes("/") &&
			!planId.includes("\\") &&
			PLAN_ID_PATTERN.test(planId);

		return { planId, valid };
	};

	if (trimmed.startsWith(GLOBAL_PLAN_PREFIX)) {
		return { scope: "global", ...normalizePlanId(trimmed.slice(GLOBAL_PLAN_PREFIX.length)) };
	}
	if (trimmed.startsWith(PROJECT_PLAN_PREFIX)) {
		return { scope: "project", ...normalizePlanId(trimmed.slice(PROJECT_PLAN_PREFIX.length)) };
	}
	return { scope: defaultScope, ...normalizePlanId(trimmed) };
}
