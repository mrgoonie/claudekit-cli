/**
 * Optional packages installation phase for setup command
 * Prompts user to install OpenCode and Gemini CLIs
 */

import { installGemini, isGeminiInstalled } from "@/services/package-installer/gemini-installer.js";
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

	// Check and prompt for Gemini CLI
	const hasGemini = await isGeminiInstalled();
	if (hasGemini) {
		clack.log.success("Google Gemini CLI: already installed");
	} else {
		const installGem = await clack.confirm({
			message: "Install Google Gemini CLI? (AI assistant)",
			initialValue: false,
		});

		if (clack.isCancel(installGem)) {
			return { ...ctx, cancelled: true };
		}

		if (installGem) {
			const result = await installGemini();
			if (result.success) {
				installedPackages.push("Google Gemini CLI");
			} else {
				clack.log.warning(`Failed to install Gemini CLI: ${result.error || "Unknown error"}`);
			}
		}
	}

	return {
		...ctx,
		packagesInstalled: installedPackages,
	};
}
