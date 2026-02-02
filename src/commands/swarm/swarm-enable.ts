/**
 * Swarm Enable Command
 *
 * Enables CK Swarm mode by patching Claude Code CLI.
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import {
	createBackup,
	getBackupPath,
	installSwarmHook,
	installSwarmSkill,
	locateCliJs,
	patchSwarmGate,
	readSwarmState,
	restoreFromBackup,
	withLock,
	writeSwarmState,
} from "@/domains/swarm/index.js";
import { intro, log, outro, spinner } from "@/shared/safe-prompts.js";
import pc from "picocolors";

interface EnableOptions {
	force?: boolean;
	yes?: boolean;
}

/**
 * Compare semantic versions (e.g., "2.1.16" >= "2.1.16")
 */
function isVersionGte(version: string, min: string): boolean {
	// Strip pre-release suffix (e.g., "2.1.16-beta.1" → "2.1.16")
	const cleanVersion = version.split("-")[0];
	const cleanMin = min.split("-")[0];

	const vParts = cleanVersion.split(".").map(Number);
	const mParts = cleanMin.split(".").map(Number);

	for (let i = 0; i < Math.max(vParts.length, mParts.length); i++) {
		const v = vParts[i] || 0;
		const m = mParts[i] || 0;
		if (v > m) return true;
		if (v < m) return false;
	}
	return true; // equal
}

export async function swarmEnable(options: EnableOptions): Promise<void> {
	await withLock("enable", async () => {
		intro("CK Swarm — Enable Multi-Agent Mode");

		// Step 1: Locate Claude Code CLI
		const s = spinner();
		s.start("Locating Claude Code CLI...");

		const result = await locateCliJs();
		if (!result) {
			s.stop("Claude Code CLI not found");
			log.error("Claude Code CLI (cli.js) not found in standard locations");
			log.message("Make sure Claude Code is installed and accessible");
			outro(pc.red("Swarm mode enable failed"));
			return;
		}

		s.stop(`Found at ${pc.cyan(result.path)}`);

		// Step 2: Version check
		const version = result.version || "unknown";
		if (version === "unknown" || !isVersionGte(version, "2.1.16")) {
			log.error(`Claude Code version ${version} is not supported`);
			log.message("Swarm mode requires Claude Code >= 2.1.16");
			outro(pc.red("Swarm mode enable failed"));
			return;
		}

		log.success(`Claude Code version: ${version}`);

		// Step 3: Check existing state
		const state = readSwarmState();
		if (state?.enabled && !options.force) {
			log.info("Swarm mode is already enabled");
			log.message(`Last patched: ${state.patchedAt}`);
			log.message("Use --force to re-patch");
			outro(pc.green("Swarm mode is active"));
			return;
		}

		// Step 4: Restore from backup if force-repatching (so we patch the original)
		if (options.force && state?.enabled && state?.backupPath) {
			s.start("Restoring original cli.js from backup...");
			try {
				await restoreFromBackup(result.path);
				s.stop("Original restored");
			} catch (error) {
				s.stop("Restore failed, continuing with current file");
				log.warn(`${error instanceof Error ? error.message : "Unknown error"}`);
			}
		}

		// Step 5: Backup cli.js (backup the original/restored version)
		s.start("Backing up cli.js...");
		try {
			createBackup(result.path);
			s.stop("Backup created");
		} catch (error) {
			s.stop("Backup failed");
			log.error(
				`Failed to create backup: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
			outro(pc.red("Swarm mode enable failed"));
			return;
		}

		// Step 5: Read and patch cli.js
		s.start("Patching cli.js...");
		let content: string;
		try {
			content = readFileSync(result.path, "utf-8");
		} catch (error) {
			s.stop("Failed to read cli.js");
			log.error(`Cannot read cli.js: ${error instanceof Error ? error.message : "Unknown error"}`);
			outro(pc.red("Swarm mode enable failed"));
			return;
		}

		const patchResult = patchSwarmGate(content);
		if (!patchResult.changed) {
			s.stop("Patch pattern not found");
			log.warn("Could not find the swarm gate pattern in cli.js");
			log.message("This may indicate an incompatible Claude Code version");
			outro(pc.red("Swarm mode enable failed"));
			return;
		}

		// Step 6: Write patched content
		try {
			writeFileSync(result.path, patchResult.content, "utf-8");
			s.stop("Patch applied successfully");
		} catch (error) {
			s.stop("Failed to write patched cli.js");

			// Check for permission error
			if (error instanceof Error && "code" in error && error.code === "EACCES") {
				log.error("Permission denied writing to cli.js");
				if (process.platform !== "win32") {
					log.message("Try running with elevated privileges:");
					log.message(pc.cyan("  sudo ck swarm enable"));
				} else {
					log.message("Try running as Administrator");
				}
			} else {
				log.error(
					`Failed to write cli.js: ${error instanceof Error ? error.message : "Unknown error"}`,
				);
			}

			outro(pc.red("Swarm mode enable failed"));
			return;
		}

		// Step 7: Compute hash and save state
		const hash = createHash("sha256").update(patchResult.content).digest("hex");
		const backupPath = getBackupPath(result.path);
		writeSwarmState({
			enabled: true,
			cliJsPath: result.path,
			cliJsHash: hash,
			backupPath: backupPath,
			ccVersion: version,
			patchedAt: new Date().toISOString(),
		});

		// Step 8: Install hook
		s.start("Installing auto-reapply hook...");
		try {
			installSwarmHook();
			s.stop("Hook installed");
		} catch (error) {
			s.stop("Hook installation failed");
			log.warn(
				`Could not install hook: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
			log.message("Swarm mode is enabled, but auto-reapply won't work");
		}

		// Step 9: Install skill
		s.start("Installing ck-swarm skill...");
		try {
			installSwarmSkill();
			s.stop("Skill installed");
		} catch (error) {
			s.stop("Skill installation failed");
			log.warn(
				`Could not install skill: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}

		// Success outro
		outro(pc.green("Swarm mode enabled!"));

		console.log();
		log.success("Features unlocked:");
		log.message("  • TeammateTool - spawn AI teammates with /teammate command");
		log.message("  • Delegate mode - offload tasks to AI agents");
		log.message("  • Teammate mailbox - structured inter-agent communication");
		log.message("  • Swarm spawning - create autonomous agent networks");
		console.log();
	});
}
