/**
 * Optional packages installation phase for setup command
 * Prompts user to install OpenCode and the Antigravity (agy) CLIs
 */

import { installAgy, isAgyInstalled } from "@/services/package-installer/agy-installer.js";
import {
	installOpenCode,
	isOpenCodeInstalled,
} from "@/services/package-installer/opencode-installer.js";
import * as clack from "@clack/prompts";
import type { SetupContext } from "../types.js";

/**
 * Handle optional package installations
 * Returns updated context with list of installed packages
 */
export async function handleOptionalPackages(ctx: SetupContext): Promise<SetupContext> {
	if (ctx.options.skipPackages) {
		clack.log.info("Skipping optional package installation (--skip-packages)");
		return ctx;
	}

	clack.log.step("Optional packages setup");

	const installedPackages: string[] = [];

	// Check and prompt for OpenCode CLI
	const hasOpenCode = await isOpenCodeInstalled();
	if (hasOpenCode) {
		clack.log.success("OpenCode CLI: already installed");
	} else {
		const installOC = await clack.confirm({
			message: "Install OpenCode CLI? (AI-powered code editor)",
			initialValue: false,
		});

		if (clack.isCancel(installOC)) {
			return { ...ctx, cancelled: true };
		}

		if (installOC) {
			const result = await installOpenCode();
			if (result.success) {
				installedPackages.push("OpenCode CLI");
			} else {
				clack.log.warning(`Failed to install OpenCode CLI: ${result.error || "Unknown error"}`);
			}
		}
	}

	// Check and prompt for Antigravity (agy) CLI
	const hasAgy = await isAgyInstalled();
	if (hasAgy) {
		clack.log.success("Antigravity CLI (agy): already installed");
	} else {
		const installAgyChoice = await clack.confirm({
			message: "Install Antigravity CLI (agy)? (AI assistant)",
			initialValue: false,
		});

		if (clack.isCancel(installAgyChoice)) {
			return { ...ctx, cancelled: true };
		}

		if (installAgyChoice) {
			const result = await installAgy();
			if (result.success) {
				installedPackages.push("Antigravity CLI (agy)");
			} else {
				clack.log.warning(
					`Failed to install Antigravity CLI (agy): ${result.error || "Unknown error"}`,
				);
			}
		}
	}

	return {
		...ctx,
		packagesInstalled: installedPackages,
	};
}
