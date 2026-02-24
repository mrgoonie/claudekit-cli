import { existsSync } from "node:fs";
import { cp, mkdir, rename, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { addPortableInstallation } from "../portable/portable-registry.js";
import { providers } from "../portable/provider-registry.js";
import type { PortableInstallResult, ProviderType } from "../portable/types.js";
import type { SkillInfo } from "../skills/types.js";

/**
 * Install skill directories preserving full structure (scripts, assets, references/).
 * Warns when overwriting existing skill directories (#406).
 */
export async function installSkillDirectories(
	skills: SkillInfo[],
	targetProviders: ProviderType[],
	options: { global: boolean },
): Promise<PortableInstallResult[]> {
	const results: PortableInstallResult[] = [];

	for (const provider of targetProviders) {
		const config = providers[provider];
		const skillConfig = config.skills;

		if (!skillConfig) {
			results.push({
				provider,
				providerDisplayName: config.displayName,
				success: false,
				path: "",
				error: `${config.displayName} does not support skills`,
			});
			continue;
		}

		const basePath = options.global ? skillConfig.globalPath : skillConfig.projectPath;
		if (!basePath) {
			results.push({
				provider,
				providerDisplayName: config.displayName,
				success: false,
				path: "",
				error: `${config.displayName} does not support ${options.global ? "global" : "project"}-level skills`,
			});
			continue;
		}

		for (const skill of skills) {
			const targetDir = join(basePath, skill.name);

			// Skip when source and destination are identical (common in Claude Code project scope)
			if (resolve(skill.path) === resolve(targetDir)) {
				results.push({
					provider,
					providerDisplayName: config.displayName,
					success: true,
					path: targetDir,
					skipped: true,
					skipReason: "Already at source location",
				});
				continue;
			}

			try {
				if (!existsSync(basePath)) {
					await mkdir(basePath, { recursive: true });
				}

				// Detect existing skill directory and warn about overwrite
				const alreadyExists = existsSync(targetDir);
				const backupDir = alreadyExists
					? `${targetDir}.ck-backup-${process.pid}-${Date.now()}`
					: null;
				let copied = false;

				if (backupDir) {
					await rename(targetDir, backupDir);
				}

				try {
					await cp(skill.path, targetDir, { recursive: true, force: true });
					copied = true;

					await addPortableInstallation(
						skill.name,
						"skill",
						provider,
						options.global,
						targetDir,
						skill.path,
					);
				} catch (error) {
					try {
						if (copied && existsSync(targetDir)) {
							await rm(targetDir, { recursive: true, force: true });
						}
						if (backupDir && existsSync(backupDir)) {
							await rename(backupDir, targetDir);
						}
					} catch (rollbackError) {
						const message = error instanceof Error ? error.message : "Unknown error";
						throw new Error(
							`${message}; rollback failed: ${rollbackError instanceof Error ? rollbackError.message : "Unknown error"}`,
						);
					}
					throw error;
				}

				if (backupDir && existsSync(backupDir)) {
					await rm(backupDir, { recursive: true, force: true });
				}

				const warnings: string[] = [];
				if (alreadyExists) {
					warnings.push(`Overwrote existing skill directory: ${skill.name}`);
				}

				results.push({
					provider,
					providerDisplayName: config.displayName,
					success: true,
					path: targetDir,
					overwritten: alreadyExists,
					warnings: warnings.length > 0 ? warnings : undefined,
				});
			} catch (error) {
				results.push({
					provider,
					providerDisplayName: config.displayName,
					success: false,
					path: targetDir,
					error: error instanceof Error ? error.message : "Unknown error",
				});
			}
		}
	}

	return results;
}
