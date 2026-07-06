import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
	type PackageManager,
	PackageManagerDetector,
} from "@/domains/installation/package-manager-detector.js";
import { parseJsonContent } from "@/shared/json-content.js";
import { logger } from "@/shared/logger.js";
import type { SkillsPackageManager } from "@/types";

export type SkillsJavascriptPackageManager = Exclude<SkillsPackageManager, "auto">;
export type SkillsPackageManagerSource = "explicit" | "project" | "detected" | "fallback";

export interface ResolvedSkillsPackageManager {
	packageManager: SkillsJavascriptPackageManager;
	source: SkillsPackageManagerSource;
}

const SKILLS_JAVASCRIPT_PACKAGE_MANAGERS = new Set<SkillsJavascriptPackageManager>([
	"npm",
	"bun",
	"pnpm",
	"yarn",
]);

export function isSkillsJavascriptPackageManager(
	value: unknown,
): value is SkillsJavascriptPackageManager {
	return (
		typeof value === "string" &&
		SKILLS_JAVASCRIPT_PACKAGE_MANAGERS.has(value as SkillsJavascriptPackageManager)
	);
}

function normalizeDetectedPackageManager(
	packageManager: PackageManager | null | undefined,
): SkillsJavascriptPackageManager | null {
	return isSkillsJavascriptPackageManager(packageManager) ? packageManager : null;
}

export async function readConfiguredProjectPackageManager(
	projectDir: string,
	isGlobal = false,
): Promise<SkillsJavascriptPackageManager | null> {
	const configPath = isGlobal
		? join(projectDir, ".ck.json")
		: join(projectDir, ".claude", ".ck.json");
	if (!existsSync(configPath)) return null;

	try {
		const content = await readFile(configPath, "utf-8");
		const config = parseJsonContent<Record<string, unknown>>(content);
		const project =
			config.project && typeof config.project === "object"
				? (config.project as Record<string, unknown>)
				: null;
		const configured = project?.packageManager;
		return isSkillsJavascriptPackageManager(configured) ? configured : null;
	} catch (error) {
		logger.debug(
			`Could not read project package manager from ${configPath}: ${
				error instanceof Error ? error.message : "unknown error"
			}`,
		);
		return null;
	}
}

export interface ResolveSkillsPackageManagerOptions {
	requested?: SkillsPackageManager;
	projectDir?: string;
	isGlobal?: boolean;
	detectPackageManager?: () => Promise<PackageManager>;
}

export async function resolveSkillsPackageManager({
	requested = "auto",
	projectDir,
	isGlobal = false,
	detectPackageManager = PackageManagerDetector.detect,
}: ResolveSkillsPackageManagerOptions = {}): Promise<ResolvedSkillsPackageManager> {
	if (requested !== "auto") {
		return {
			packageManager: requested,
			source: "explicit",
		};
	}

	if (projectDir && !isGlobal) {
		const projectPackageManager = await readConfiguredProjectPackageManager(projectDir, isGlobal);
		if (projectPackageManager) {
			return {
				packageManager: projectPackageManager,
				source: "project",
			};
		}
	}

	const detectedPackageManager = normalizeDetectedPackageManager(await detectPackageManager());
	if (detectedPackageManager) {
		return {
			packageManager: detectedPackageManager,
			source: "detected",
		};
	}

	return {
		packageManager: "npm",
		source: "fallback",
	};
}
