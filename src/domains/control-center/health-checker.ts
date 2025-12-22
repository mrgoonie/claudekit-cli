/**
 * Health Checker - Config validation and version checking
 * Aggregates validation issues from ResolutionTracer and checks for updates
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ResolutionTracer } from "@/domains/config/resolution-tracer.js";
import { ConfigSchemaWithDescriptions } from "@/domains/config/schema-descriptions.js";
import { CliVersionChecker } from "@/domains/versioning/version-checker.js";
import { logger } from "@/shared/logger.js";

// Read version from package.json at build time
const CLI_VERSION = process.env.npm_package_version || "0.0.0";

export type IssueSeverity = "error" | "warning" | "info";

export interface HealthIssue {
	severity: IssueSeverity;
	message: string;
	field?: string;
}

export interface VersionInfo {
	current: string;
	latest: string | null;
	updateAvailable: boolean;
}

export interface HealthStatus {
	healthy: boolean;
	issues: HealthIssue[];
	version: VersionInfo;
}

/**
 * Check health of a project's configuration
 * @param projectPath - Path to the project (optional, uses cwd if not provided)
 */
export async function checkHealth(projectPath?: string): Promise<HealthStatus> {
	const issues: HealthIssue[] = [];
	const path = projectPath || process.cwd();

	// Check project structure
	const structureIssues = checkProjectStructure(path);
	issues.push(...structureIssues);

	// Check config resolution and validation
	const configIssues = await checkConfigResolution(path);
	issues.push(...configIssues);

	// Check CLI version
	const versionInfo = await checkVersion();

	// Determine overall health
	const hasErrors = issues.some((i) => i.severity === "error");
	const healthy = !hasErrors && !versionInfo.updateAvailable;

	return {
		healthy,
		issues,
		version: versionInfo,
	};
}

/**
 * Check project structure for common issues
 */
function checkProjectStructure(projectPath: string): HealthIssue[] {
	const issues: HealthIssue[] = [];

	// Check if .claude directory exists
	const claudeDir = join(projectPath, ".claude");
	if (!existsSync(claudeDir)) {
		issues.push({
			severity: "info",
			message: "No .claude directory found. Consider running 'ck init' to set up ClaudeKit.",
		});
	}

	// Check for CLAUDE.md
	const claudeMd = join(projectPath, "CLAUDE.md");
	if (!existsSync(claudeMd)) {
		issues.push({
			severity: "info",
			message: "No CLAUDE.md file found. This file helps Claude understand your project.",
		});
	}

	// Check for .ck.json in .claude
	const localConfig = join(claudeDir, ".ck.json");
	if (existsSync(claudeDir) && !existsSync(localConfig)) {
		issues.push({
			severity: "info",
			message: "No local configuration file (.claude/.ck.json). Using global/default settings.",
		});
	}

	return issues;
}

/**
 * Check config resolution and validate merged config
 */
async function checkConfigResolution(projectPath: string): Promise<HealthIssue[]> {
	const issues: HealthIssue[] = [];

	try {
		const result = await ResolutionTracer.trace(projectPath, false);

		// Validate merged config against schema
		const validationResult = ConfigSchemaWithDescriptions.safeParse(unflattenConfig(result.merged));

		if (!validationResult.success) {
			for (const error of validationResult.error.issues) {
				issues.push({
					severity: "warning",
					message: error.message,
					field: error.path.join("."),
				});
			}
		}
	} catch (error) {
		logger.debug(`Config resolution error: ${error}`);
		issues.push({
			severity: "error",
			message: `Failed to load configuration: ${error instanceof Error ? error.message : "Unknown error"}`,
		});
	}

	return issues;
}

/**
 * Check CLI version against latest release
 */
async function checkVersion(): Promise<VersionInfo> {
	try {
		const versionResult = await CliVersionChecker.check(CLI_VERSION);

		if (versionResult) {
			return {
				current: versionResult.currentVersion,
				latest: versionResult.latestVersion,
				updateAvailable: versionResult.updateAvailable,
			};
		}
	} catch (error) {
		logger.debug(`Version check failed: ${error}`);
	}

	return {
		current: CLI_VERSION,
		latest: null,
		updateAvailable: false,
	};
}

/**
 * Unflatten dot-notation config to nested object
 */
function unflattenConfig(config: Record<string, unknown>): Record<string, unknown> {
	const result: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(config)) {
		const keys = key.split(".");
		let current = result;

		for (let i = 0; i < keys.length - 1; i++) {
			if (!(keys[i] in current)) {
				current[keys[i]] = {};
			}
			current = current[keys[i]] as Record<string, unknown>;
		}

		current[keys[keys.length - 1]] = value;
	}

	return result;
}
