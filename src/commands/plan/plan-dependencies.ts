import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { CkConfigManager } from "@/domains/config/index.js";
import {
	buildPlanSummary,
	inferPlanScopeForDir,
	parsePlanReference,
	resolvePlanDirForScope,
} from "@/domains/plan-parser/index.js";
import type { PlanBoardStatus, PlanScope } from "@/domains/plan-parser/plan-types.js";
import { findProjectRoot } from "@/domains/plan-parser/plans-registry.js";

export interface ResolvedPlanDependency {
	reference: string;
	scope: PlanScope;
	planId: string;
	planFile: string;
	exists: boolean;
	title?: string;
	status?: PlanBoardStatus;
}

export async function resolvePlanDependencies(
	references: string[],
	currentPlanFile: string,
): Promise<ResolvedPlanDependency[]> {
	if (references.length === 0) return [];

	const currentPlanDir = dirname(currentPlanFile);
	const projectRoot = findProjectRoot(currentPlanDir);
	const { config } = await CkConfigManager.loadFull(projectRoot);
	const defaultScope = inferPlanScopeForDir(currentPlanDir, config);

	return references.map((reference) => {
		const { scope, planId, valid } = parsePlanReference(reference, defaultScope);
		if (!valid) {
			return {
				reference,
				scope,
				planId,
				planFile: "",
				exists: false,
			};
		}
		const scopeRoot = resolvePlanDirForScope(scope, projectRoot, config);
		const planFile = join(scopeRoot, planId, "plan.md");
		if (!existsSync(planFile)) {
			return {
				reference,
				scope,
				planId,
				planFile,
				exists: false,
			};
		}

		const summary = buildPlanSummary(planFile);
		return {
			reference,
			scope,
			planId,
			planFile,
			exists: true,
			title: summary.title,
			status: summary.status,
		};
	});
}
