import { existsSync } from "node:fs";
import { cp, mkdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { rewriteAntigravityPaths } from "../portable/converters/direct-copy.js";
import { addPortableInstallation } from "../portable/portable-registry.js";
import { providers } from "../portable/provider-registry.js";
import type { PortableInstallResult, ProviderType } from "../portable/types.js";
import type { SkillInfo } from "../skills/types.js";

/**
 * Resolve a path to its canonical form, following symlinks. Falls back to the
 * canonical parent + basename when the leaf itself doesn't exist yet so that
 * not-yet-created paths inside symlinked parents still canonicalise correctly.
 */
async function canonicalize(path: string): Promise<string> {
	try {
		return await realpath(path);
	} catch {
		const parent = dirname(path);
		if (parent === path) {
			return resolve(path);
		}
		try {
			const canonicalParent = await realpath(parent);
			const absPath = resolve(path);
			const absParent = resolve(parent);
			const basename = absPath.slice(absParent.length + 1) || "";
			return join(canonicalParent, basename);
		} catch {
			return resolve(path);
		}
	}
}

async function rewriteInstalledSkillMd(
	targetDir: string,
	provider: ProviderType,
	options: { global: boolean },
): Promise<void> {
	if (provider !== "antigravity") return;

	const skillMdPath = join(targetDir, "SKILL.md");
	if (!existsSync(skillMdPath)) return;

	const content = await readFile(skillMdPath, "utf-8");
	const rewritten = rewriteAntigravityPaths(content, { global: options.global });
	if (rewritten !== content) {
		await writeFile(skillMdPath, rewritten, "utf-8");
	}
}

/**
 * Install skill directories preserving full structure (scripts, assets, references/).
 * Warns when overwriting existing skill directories (#406).
 *
 * Handles symlinked target directories (#817): if the provider's skills base
 * path resolves (via realpath) to the same canonical directory as the source
 * root, every per-skill copy would clobber its own source. Detect once at the
 * basePath level, emit one clear skip per skill, and avoid destructive rename+copy.
 *
 * Note: Provider path collision warnings (#450) are handled by annotateCollisions()
 * in migration-result-utils.ts after all results are collected — single source of truth.
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

		// Detect basePath-level symlink loop: if the target skills directory
		// resolves to the same canonical path as the source root, per-skill
		// rename+copy would clobber the source itself. Skip the whole provider
		// cleanly so the user gets one clear message per skill, not 79 ENOENTs.
		//
		// Invariant: all skills in a single batch share the same parent directory
		// (callers build batches from a single source root per migration run).
		// We sample skills[0] as a proxy for the batch's source root — this is
		// an optimisation; the per-skill canonical check below still catches any
		// mixed-batch outlier safely (just without the single-message UX win).
		const sourceRoot = skills.length > 0 ? dirname(skills[0].path) : null;
		const canonicalBase = existsSync(basePath) ? await canonicalize(basePath) : null;
		const canonicalSourceRoot = sourceRoot ? await canonicalize(sourceRoot) : null;
		const basePathIsSymlinkedToSource =
			canonicalBase !== null &&
			canonicalSourceRoot !== null &&
			canonicalBase === canonicalSourceRoot &&
			resolve(basePath) !== resolve(sourceRoot ?? "");

		if (basePathIsSymlinkedToSource) {
			for (const skill of skills) {
				results.push({
					provider,
					providerDisplayName: config.displayName,
					success: true,
					path: join(basePath, skill.name),
					skipped: true,
					skipReason: `Skills directory ${basePath} is symlinked to source (${canonicalBase}); already in place`,
				});
			}
			continue;
		}

		for (const skill of skills) {
			const targetDir = join(basePath, skill.name);

			// Canonical (symlink-aware) comparison — catches per-skill cases where
			// individual skills happen to point at the same inode regardless of
			// basePath identity (e.g. Claude Code project scope).
			const canonicalSource = await canonicalize(skill.path);
			const canonicalTarget = await canonicalize(targetDir);
			if (canonicalSource === canonicalTarget) {
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
					await rewriteInstalledSkillMd(targetDir, provider, options);

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
