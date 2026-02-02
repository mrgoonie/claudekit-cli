/**
 * Swarm Status Command
 *
 * Displays current swarm mode status and configuration.
 */

import { readFileSync } from "node:fs";
import {
	type SwarmModeState,
	detectSwarmModeState,
	isHookInstalled,
	isSwarmSkillInstalled,
	locateCliJs,
	readSwarmState,
} from "@/domains/swarm/index.js";
import { intro, log } from "@/shared/safe-prompts.js";
import pc from "picocolors";

export async function swarmStatus(): Promise<void> {
	intro("CK Swarm — Status");

	// Try to read state first
	const state = readSwarmState();

	if (state?.enabled) {
		// Show state-based status
		log.success(`Swarm Mode: ${pc.green("enabled")}`);
		log.info(`Claude Code: v${state.ccVersion} at ${pc.cyan(state.cliJsPath)}`);
		log.info(`Last patched: ${state.patchedAt}`);

		// Check hook status
		const hookInstalled = isHookInstalled();
		if (hookInstalled) {
			log.success(`Auto-reapply hook: ${pc.green("installed")}`);
		} else {
			log.warn(`Auto-reapply hook: ${pc.yellow("not installed")}`);
		}

		// Check skill status
		const skillInstalled = isSwarmSkillInstalled();
		if (skillInstalled) {
			log.success(`ck-swarm skill: ${pc.green("installed")}`);
		} else {
			log.warn(`ck-swarm skill: ${pc.yellow("not installed")}`);
		}
	} else {
		// No state file - try to detect from CLI
		const result = await locateCliJs();

		if (!result) {
			log.error(`Swarm Mode: ${pc.red("disabled")}`);
			log.warn("Claude Code CLI not found");
			console.log();
			return;
		}

		log.info(`Claude Code: v${result.version || "unknown"} at ${pc.cyan(result.path)}`);

		// Check if patched without state file
		let modeState: SwarmModeState = "unknown";
		try {
			const content = readFileSync(result.path, "utf-8");
			modeState = detectSwarmModeState(content);
		} catch {
			log.warn("Could not read cli.js file");
		}

		if (modeState === "enabled") {
			log.warn(`Swarm Mode: ${pc.yellow("enabled (no state file)")}`);
			log.message("State file missing - run 'ck swarm doctor' to diagnose");
		} else if (modeState === "disabled") {
			log.info(`Swarm Mode: ${pc.gray("disabled")}`);
		} else {
			log.warn(`Swarm Mode: ${pc.yellow("unknown")}`);
			log.message("Could not detect swarm gate state");
		}

		// Check hook status
		const hookInstalled = isHookInstalled();
		log.info(
			`Auto-reapply hook: ${hookInstalled ? pc.green("installed") : pc.gray("not installed")}`,
		);

		// Check skill status
		const skillInstalled = isSwarmSkillInstalled();
		log.info(
			`ck-swarm skill: ${skillInstalled ? pc.green("installed") : pc.gray("not installed")}`,
		);
	}

	console.log();
}
