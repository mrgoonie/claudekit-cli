#!/usr/bin/env bun
/**
 * Generate CLI Manifest
 *
 * Exports generateManifest() returning a machine-readable JSON snapshot of
 * all commands from HELP_REGISTRY. Output is written to cli-manifest.json
 * at the repo root.
 *
 * Usage: bun scripts/generate-cli-manifest.ts
 * Output: cli-manifest.json
 */

import { execSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import _pkg from "../package.json" with { type: "json" };
import { HELP_REGISTRY } from "../src/domains/help/help-commands.js";
import type { CommandHelp } from "../src/domains/help/help-types.js";

/** Shape of the generated manifest */
export interface CliManifest {
	version: string;
	generatedAt: string;
	commands: Record<string, CommandHelp>;
}

/**
 * Build the manifest object from HELP_REGISTRY.
 *
 * Keys in `commands` are sorted alphabetically for deterministic diffs.
 * Version is pulled from package.json via Bun's import resolution.
 */
export function generateManifest(): CliManifest {
	// Sort command keys alphabetically for stable output
	const sortedKeys = Object.keys(HELP_REGISTRY).sort();
	const commands: Record<string, CommandHelp> = {};
	for (const key of sortedKeys) {
		commands[key] = HELP_REGISTRY[key];
	}

	return {
		version: _pkg.version,
		generatedAt: new Date().toISOString(),
		commands,
	};
}

// CLI entrypoint — only runs when executed directly (not when imported by tests)
if (import.meta.main) {
	const repoRoot = new URL("..", import.meta.url).pathname;
	const outputPath = join(repoRoot, "cli-manifest.json");

	const manifest = generateManifest();
	// Use tab indent to match project biome formatter settings
	const content = `${JSON.stringify(manifest, null, "\t")}\n`;

	await writeFile(outputPath, content, "utf-8");

	// Run biome formatter so the JSON matches project style (e.g. single-element arrays inline)
	try {
		execSync(`bunx biome format --write "${outputPath}"`, { stdio: "ignore" });
	} catch (err) {
		console.warn("[!] biome format skipped:", err instanceof Error ? err.message : String(err));
	}

	console.log(`[OK] Generated: ${outputPath}`);
	console.log(`[i]  Version:   ${manifest.version}`);
	console.log(`[i]  Commands:  ${Object.keys(manifest.commands).length}`);
	console.log(`[i]  Timestamp: ${manifest.generatedAt}`);
}
