import { BackupManager } from "@/domains/config/backup-manager.js";
import { PathResolver } from "@/shared/path-resolver.js";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import pc from "picocolors";

export async function unsetConfig(key: string, options: { global?: boolean }) {
	const isGlobal = options.global ?? false;

	if (isGlobal) {
		const configFile = PathResolver.getConfigFile(true);
		if (!existsSync(configFile)) {
			console.log(pc.yellow("No global config file exists"));
			return;
		}

		const content = await readFile(configFile, "utf-8");
		const config = JSON.parse(content);

		// Create backup
		await BackupManager.createBackup(configFile);

		// Remove key
		deleteNestedKey(config, key);

		// Save
		await writeFile(configFile, JSON.stringify(config, null, 2), "utf-8");
		console.log(pc.green(`Unset ${key} (global)`));
	} else {
		const configPath = join(process.cwd(), ".claude", ".ck.json");
		if (!existsSync(configPath)) {
			console.log(pc.yellow("No local config file exists"));
			return;
		}

		const content = await readFile(configPath, "utf-8");
		const config = JSON.parse(content);

		// Create backup
		await BackupManager.createBackup(configPath);

		// Remove key
		deleteNestedKey(config, key);

		// Save
		await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
		console.log(pc.green(`Unset ${key} (local)`));
	}
}

function deleteNestedKey(obj: Record<string, unknown>, path: string): void {
	const keys = path.split(".");
	let current = obj;
	for (let i = 0; i < keys.length - 1; i++) {
		if (!(keys[i] in current)) return;
		current = current[keys[i]] as Record<string, unknown>;
	}
	delete current[keys[keys.length - 1]];
}
