import { existsSync } from "node:fs";
import { cp, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { addPortableInstallation } from "../portable/portable-registry.js";
import { providers } from "../portable/provider-registry.js";
import type { PortableInstallResult, ProviderType } from "../portable/types.js";
import type { SkillInfo } from "../skills/types.js";

/**
 * Install skill directories preserving full structure (scripts, assets, references/)
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

				await cp(skill.path, targetDir, { recursive: true, force: true });

				await addPortableInstallation(
					skill.name,
					"skill",
					provider,
					options.global,
					targetDir,
					skill.path,
				);

				results.push({
					provider,
					providerDisplayName: config.displayName,
					success: true,
					path: targetDir,
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
