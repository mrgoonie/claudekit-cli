/**
 * Swarm Disable Command
 *
 * Disables CK Swarm mode by restoring original cli.js.
 */

import {
	clearSwarmState,
	hasBackup,
	locateCliJs,
	readSwarmState,
	removeSwarmHook,
	removeSwarmSkill,
	restoreFromBackup,
	withLock,
} from "@/domains/swarm/index.js";
import { confirm, intro, isCancel, log, outro, spinner } from "@/shared/safe-prompts.js";
import pc from "picocolors";

export async function swarmDisable(options: { yes?: boolean } = {}): Promise<void> {
	await withLock("disable", async () => {
		intro("CK Swarm — Disable Multi-Agent Mode");

		// Step 1: Check if enabled
		const state = readSwarmState();
		if (!state?.enabled) {
			log.error("Swarm mode is not enabled");
			log.message("Nothing to disable");
			outro(pc.yellow("No action taken"));
			return;
		}

		// Step 2: Check backup exists
		if (!hasBackup(state.cliJsPath)) {
			log.error("Backup file not found");
			log.message("Cannot restore cli.js without backup");
			log.message("You may need to reinstall Claude Code");
			outro(pc.red("Disable failed"));
			return;
		}

		// Step 3: Confirm with user (skip if --yes)
		if (!options.yes) {
			const confirmed = await confirm({
				message: "Disable swarm mode and restore original cli.js?",
			});

			if (isCancel(confirmed) || !confirmed) {
				log.info("Operation cancelled");
				outro(pc.yellow("No changes made"));
				return;
			}
		}

		// Step 4: Warn if CC version changed
		const currentResult = await locateCliJs();
		if (currentResult && state.ccVersion !== currentResult.version) {
			log.warn(`Claude Code version changed: ${state.ccVersion} → ${currentResult.version}`);
			if (!options.yes) {
				const proceed = await confirm({
					message: "Backup is from different version. Restore anyway?",
				});
				if (isCancel(proceed) || !proceed) {
					log.info("Operation cancelled");
					outro(pc.yellow("No changes made"));
					return;
				}
			}
		}

		// Step 5: Restore backup
		const s = spinner();
		s.start("Restoring original cli.js...");

		try {
			restoreFromBackup(state.cliJsPath);
			s.stop("cli.js restored");
		} catch (error) {
			s.stop("Restore failed");
			log.error(
				`Failed to restore backup: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
			outro(pc.red("Disable failed"));
			return;
		}

		// Step 6: Remove hook
		s.start("Removing auto-reapply hook...");
		try {
			removeSwarmHook();
			s.stop("Hook removed");
		} catch (error) {
			s.stop("Hook removal failed");
			log.warn(
				`Could not remove hook: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}

		// Step 7: Remove skill
		s.start("Removing ck-swarm skill...");
		try {
			removeSwarmSkill();
			s.stop("Skill removed");
		} catch (error) {
			s.stop("Skill removal failed");
			log.warn(
				`Could not remove skill: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}

		// Step 8: Clear state
		clearSwarmState();

		// Success outro
		outro(pc.green("Swarm mode disabled"));
		console.log();
		log.info("Claude Code restored to original state");
		console.log();
	});
}
