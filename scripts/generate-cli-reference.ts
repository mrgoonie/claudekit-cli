#!/usr/bin/env bun
/**
 * Generate CLI Reference Document
 *
 * Exports generateReference() returning a Markdown string with:
 *   - H1 title
 *   - Table of Contents
 *   - H2 per top-level command (description, usage, options table)
 *   - H3 per subcommand
 *   - Timestamp footer comment
 *
 * Usage: bun scripts/generate-cli-reference.ts
 * Output: docs/cli-reference.md
 */

import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { HELP_REGISTRY } from "../src/domains/help/help-commands.js";
import type { CommandHelp, OptionGroup } from "../src/domains/help/help-types.js";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Convert a heading text to a GitHub-flavored Markdown anchor slug */
function toAnchor(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-");
}

/** Render an options table from option groups. Returns empty string when no options exist. */
function renderOptionsTable(optionGroups: OptionGroup[]): string {
	const allOptions = optionGroups.flatMap((g) => g.options);
	if (allOptions.length === 0) return "";

	const rows = allOptions
		.map((opt) => {
			const flag = opt.flags.replace(/\|/g, "\\|");
			const desc = opt.description.replace(/\|/g, "\\|");
			const def = opt.defaultValue ? `\`${opt.defaultValue}\`` : "—";
			return `| \`${flag}\` | ${desc} | ${def} |`;
		})
		.join("\n");

	return `| Flag | Description | Default |\n|------|-------------|----------|\n${rows}\n`;
}

/** Render a single command section at a given heading level (H2 for top-level, H3 for subs). */
function renderCommandSection(cmd: CommandHelp, level: number): string {
	const prefix = "#".repeat(level);
	const heading = level === 2 ? `ck ${cmd.name}` : cmd.name;
	const lines: string[] = [];

	lines.push(`${prefix} ${heading}`);
	lines.push("");
	lines.push(cmd.description);
	lines.push("");
	lines.push(`**Usage:** \`${cmd.usage}\``);
	lines.push("");

	// Options table
	if (cmd.optionGroups.length > 0) {
		const table = renderOptionsTable(cmd.optionGroups);
		if (table) {
			lines.push("**Options:**");
			lines.push("");
			lines.push(table);
		}
	}

	// Examples
	if (cmd.examples.length > 0) {
		lines.push("**Examples:**");
		lines.push("");
		for (const ex of cmd.examples) {
			lines.push(`- \`${ex.command}\` — ${ex.description}`);
		}
		lines.push("");
	}

	// Additional sections (notes, warnings, etc.)
	if (cmd.sections && cmd.sections.length > 0) {
		for (const section of cmd.sections) {
			lines.push(`**${section.title}:**`);
			lines.push("");
			lines.push(section.content);
			lines.push("");
		}
	}

	// Subcommands rendered recursively at the next heading level
	if (cmd.subcommands && cmd.subcommands.length > 0) {
		for (const sub of cmd.subcommands) {
			lines.push(renderCommandSection(sub, level + 1));
		}
	}

	return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate the full CLI reference Markdown string.
 *
 * Structure:
 *   # ClaudeKit CLI Reference
 *   ## Table of Contents
 *   ## ck <command>   (one per HELP_REGISTRY entry, alpha-sorted)
 *     ### <subcommand>
 *   <!-- generated: <iso> -->
 */
export function generateReference(): string {
	const sortedKeys = Object.keys(HELP_REGISTRY).sort();
	const parts: string[] = [];

	// H1 title
	parts.push("# ClaudeKit CLI Reference");
	parts.push("");
	parts.push("Complete reference for all `ck` commands, auto-generated from the help registry.");
	parts.push("");

	// Table of Contents
	parts.push("## Table of Contents");
	parts.push("");
	for (const name of sortedKeys) {
		const anchor = toAnchor(`ck ${name}`);
		parts.push(`- [ck ${name}](#${anchor})`);
	}
	parts.push("");

	// One H2 section per command
	for (const name of sortedKeys) {
		parts.push(renderCommandSection(HELP_REGISTRY[name], 2));
		parts.push("");
	}

	// Timestamp footer for provenance
	const timestamp = new Date().toISOString();
	parts.push(`<!-- generated: ${timestamp} -->`);

	return parts.join("\n");
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------

if (import.meta.main) {
	const repoRoot = new URL("..", import.meta.url).pathname;
	const outputPath = join(repoRoot, "docs", "cli-reference.md");

	const content = generateReference();

	await writeFile(outputPath, content, "utf-8");
	console.log(`[OK] Generated: ${outputPath}`);
	console.log(`[i]  Commands:  ${Object.keys(HELP_REGISTRY).length}`);
	console.log(`[i]  Size:      ${(content.length / 1024).toFixed(1)} KB`);
}
