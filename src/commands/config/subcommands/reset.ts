import { BackupManager } from "@/domains/config/backup-manager.js";
import { PathResolver } from "@/shared/path-resolver.js";
import { confirm, isCancel } from "@/shared/safe-prompts.js";
import { existsSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import pc from "picocolors";

export async function resetConfig(options: {
	section?: string;
	global?: boolean;
	yes?: boolean;
}) {
	const isGlobal = options.global ?? false;
	const configPath = isGlobal
		? PathResolver.getConfigFile(true)
		: join(process.cwd(), ".claude", ".ck.json");

	if (!existsSync(configPath)) {
		console.log(pc.yellow("No config file to reset"));
		return;
	}

	// Confirmation
	if (!options.yes) {
		const shouldReset = await confirm({
			message: options.section
				? `Reset ${options.section} section to defaults?`
				: "Reset all config to defaults?",
		});
		if (isCancel(shouldReset) || !shouldReset) {
			console.log("Reset cancelled");
			return;
		}
	}

	// Create backup
	const backupPath = await BackupManager.createBackup(configPath);
	if (backupPath) {
		console.log(pc.dim(`Backup created: ${backupPath}`));
	}

	if (options.section) {
		// Reset specific section
		const content = await readFile(configPath, "utf-8");
		const config = JSON.parse(content);
		delete config[options.section];
		await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
		console.log(pc.green(`Reset ${options.section} section`));
	} else {
		// Remove entire config file
		await rm(configPath);
		console.log(pc.green("Reset all config to defaults"));
	}
}
