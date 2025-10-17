#!/usr/bin/env bun

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { cac } from "cac";
import { newCommand } from "./commands/new.js";
import { updateCommand } from "./commands/update.js";
import { versionCommand } from "./commands/version.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// Read package.json for version
const packageJson = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf-8"));

const cli = cac("ck");

// New command
cli
	.command("new", "Bootstrap a new ClaudeKit project")
	.option("--dir <dir>", "Target directory (default: .)")
	.option("--kit <kit>", "Kit to use (engineer, marketing)")
	.option("--version <version>", "Specific version to download (default: latest)")
	.action(async (options) => {
		await newCommand(options);
	});

// Update command
cli
	.command("update", "Update existing ClaudeKit project")
	.option("--dir <dir>", "Target directory (default: .)")
	.option("--kit <kit>", "Kit to use (engineer, marketing)")
	.option("--version <version>", "Specific version to download (default: latest)")
	.action(async (options) => {
		await updateCommand(options);
	});

// Versions command
cli
	.command("versions", "List available versions of ClaudeKit repositories")
	.option("--kit <kit>", "Filter by specific kit (engineer, marketing)")
	.option("--limit <limit>", "Number of releases to show (default: 30)")
	.option("--all", "Show all releases including prereleases")
	.action(async (options) => {
		await versionCommand(options);
	});

// Version
cli.version(packageJson.version);

// Help
cli.help();

// Parse CLI arguments
cli.parse();
