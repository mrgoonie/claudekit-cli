/**
 * Portable manifest schema and loader
 * Tracks CK evolution: renames, provider path changes, section renames across versions
 */
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import semver from "semver";
import { z } from "zod";
import { logger } from "../../shared/logger.js";

/**
 * Safe relative path validator — rejects path traversal, absolute paths, and empty strings
 * Critical for security: manifest could theoretically be tampered with
 */
const safeRelativePath = z
	.string()
	.min(1)
	.refine((p) => !p.includes("..") && !path.isAbsolute(p), {
		message: "Path must be relative without traversal",
	});

/** Source file rename entry */
const RenameEntrySchema = z.object({
	from: safeRelativePath, // Old source path relative to .claude/
	to: safeRelativePath, // New source path
	since: z.string(), // CK version where rename happened
});

/** Provider target path migration entry */
const ProviderPathMigrationSchema = z.object({
	provider: z.string(), // e.g., "codex"
	type: z.enum(["agent", "command", "skill", "config", "rules"]),
	from: safeRelativePath, // Old target directory (e.g., ".codex/skills/")
	to: safeRelativePath, // New target directory (e.g., ".agents/skills/")
	since: z.string(),
});

/** Section rename entry (for merge targets) */
const SectionRenameSchema = z.object({
	type: z.enum(["agent", "command", "skill", "config", "rules"]),
	from: safeRelativePath, // Old section name/slug (e.g., "code-reviewer")
	to: safeRelativePath, // New section name/slug (e.g., "reviewer")
	since: z.string(),
});

/** Main manifest schema */
const PortableManifestSchema = z
	.object({
		version: z.literal("1.0"),
		cliVersion: z.string(),
		renames: z.array(RenameEntrySchema).default([]),
		providerPathMigrations: z.array(ProviderPathMigrationSchema).default([]),
		sectionRenames: z.array(SectionRenameSchema).default([]),
	})
	.passthrough(); // Forward-compatible: ignore unknown fields

export type PortableManifest = z.infer<typeof PortableManifestSchema>;
export type RenameEntry = z.infer<typeof RenameEntrySchema>;
export type ProviderPathMigration = z.infer<typeof ProviderPathMigrationSchema>;
export type SectionRename = z.infer<typeof SectionRenameSchema>;

/**
 * Load and validate portable-manifest.json from kit directory
 * Returns null on missing or invalid manifest (graceful fallback)
 */
export async function loadPortableManifest(kitPath: string): Promise<PortableManifest | null> {
	const manifestPath = path.join(kitPath, "portable-manifest.json");

	try {
		if (!existsSync(manifestPath)) {
			logger.verbose("No portable-manifest.json found — no evolution tracking");
			return null;
		}

		const raw = await readFile(manifestPath, "utf-8");
		const parsed = JSON.parse(raw);
		const manifest = PortableManifestSchema.parse(parsed);

		logger.verbose(
			`Loaded portable manifest v${manifest.version} (CK ${manifest.cliVersion}) — ${manifest.renames.length} renames, ${manifest.providerPathMigrations.length} path migrations, ${manifest.sectionRenames.length} section renames`,
		);

		return manifest;
	} catch (error) {
		logger.verbose(
			`Failed to load portable manifest: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
		return null;
	}
}

/**
 * Filter manifest entries by version range
 * Include entries where: entry.since > appliedVersion && entry.since <= currentVersion
 *
 * @param entries - Array of manifest entries with 'since' field
 * @param appliedVersion - Last manifest version applied (from registry)
 * @param currentVersion - Current CK version (from manifest)
 * @returns Filtered array of applicable entries
 */
export function getApplicableEntries<T extends { since: string }>(
	entries: T[],
	appliedVersion: string | undefined,
	currentVersion: string,
): T[] {
	return entries.filter((entry) => {
		try {
			// No previously applied version → include all entries up to current version
			if (!appliedVersion) {
				// Include if entry.since <= currentVersion
				return semver.lte(entry.since, currentVersion);
			}

			// Entry applies if: entry.since > appliedVersion && entry.since <= currentVersion
			return semver.gt(entry.since, appliedVersion) && semver.lte(entry.since, currentVersion);
		} catch {
			// Semver parse error → include entry (fail open)
			logger.verbose(
				`Semver parse error for entry.since=${entry.since}, appliedVersion=${appliedVersion}, currentVersion=${currentVersion} — including entry`,
			);
			return true;
		}
	});
}
