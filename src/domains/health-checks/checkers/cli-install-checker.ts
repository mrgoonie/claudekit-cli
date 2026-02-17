import { PackageManagerDetector } from "@/domains/installation/package-manager-detector.js";
import { CLAUDEKIT_CLI_GLOBAL_INSTALL_COMMAND } from "@/shared/claudekit-constants.js";
import { logger } from "@/shared/logger.js";
import type { CheckResult } from "../types.js";

/**
 * Check how the CLI was installed (npm, bun, yarn, pnpm)
 */
export async function checkCliInstallMethod(): Promise<CheckResult> {
	// Skip external command execution in test environment to prevent hangs
	if (process.env.NODE_ENV === "test") {
		logger.verbose("ClaudekitChecker: Skipping PM detection in test mode");
		return {
			id: "ck-cli-install-method",
			name: "CLI Installed Via",
			group: "claudekit",
			priority: "standard",
			status: "pass",
			message: "Test Mode (skipped)",
			autoFixable: false,
		};
	}

	const pm = await PackageManagerDetector.detect();
	const pmVersion = await PackageManagerDetector.getVersion(pm);
	const displayName = PackageManagerDetector.getDisplayName(pm);

	return {
		id: "ck-cli-install-method",
		name: "CLI Installed Via",
		group: "claudekit",
		priority: "standard",
		status: pm !== "unknown" ? "pass" : "warn",
		message: pmVersion ? `${displayName} (v${pmVersion})` : displayName,
		suggestion: pm === "unknown" ? `Run: ${CLAUDEKIT_CLI_GLOBAL_INSTALL_COMMAND}` : undefined,
		autoFixable: false,
	};
}
