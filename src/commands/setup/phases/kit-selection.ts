/**
 * Kit selection and initialization phase for setup command
 * Prompts user to select a kit and runs `ck init` to complete installation
 */

import { initCommand } from "@/commands/init.js";
import type { KitType } from "@/types/kit.js";
import * as clack from "@clack/prompts";
import type { SetupContext } from "../types.js";

/**
 * Handle kit selection and run init command
 * Returns updated context with selected kit
 */
export async function handleKitSelection(ctx: SetupContext): Promise<SetupContext> {
	clack.log.step("Kit selection and installation");

	// Prompt for kit selection
	const kit = await clack.select<
		{ value: "engineer" | "marketing"; label: string }[],
		"engineer" | "marketing"
	>({
		message: "Which ClaudeKit starter kit do you want to install?",
		options: [
			{
				value: "engineer",
				label: "ClaudeKit Engineer - AI-powered coding toolkit",
			},
			{
				value: "marketing",
				label: "ClaudeKit Marketing - Content automation toolkit",
			},
		],
	});

	if (clack.isCancel(kit)) {
		return { ...ctx, cancelled: true };
	}

	// Run init command with selected kit and --yes flag
	clack.log.info(
		`Installing ${kit === "engineer" ? "ClaudeKit Engineer" : "ClaudeKit Marketing"}...`,
	);

	try {
		await initCommand({
			dir: ctx.targetDir,
			kit: kit as KitType,
			global: ctx.options.global,
			yes: true, // Non-interactive mode
			exclude: [],
			only: [],
			fresh: false,
			installSkills: false,
			withSudo: false,
			prefix: false,
			beta: false,
			dryRun: false,
			forceOverwrite: false,
			forceOverwriteSettings: false,
			skipSetup: true, // Skip setup wizard since we already ran it
			refresh: false,
			sync: false,
			useGit: false,
			verbose: false,
			json: false,
		});

		return {
			...ctx,
			selectedKit: kit,
		};
	} catch (error) {
		clack.log.error(
			`Failed to install kit: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
		return { ...ctx, cancelled: true };
	}
}
