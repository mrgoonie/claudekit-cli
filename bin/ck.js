#!/usr/bin/env node

/**
 * CLI entry point for npm-installed ClaudeKit CLI.
 * Runs the packaged Node-targeted bundle without requiring Bun on user machines.
 */

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const MIN_NODE_VERSION = [18, 0];
const __dirname = dirname(fileURLToPath(import.meta.url));

const getErrorMessage = (err) => {
	return err instanceof Error ? err.message : String(err);
};

const checkNodeVersion = () => {
	const [major, minor] = process.versions.node.split(".").map(Number);
	const [minMajor, minMinor] = MIN_NODE_VERSION;

	if (major < minMajor || (major === minMajor && minor < minMinor)) {
		console.error(
			`[X] Node.js ${MIN_NODE_VERSION.join(".")}+ is required. Current version: ${process.versions.node}`,
		);
		console.error("   Please upgrade Node.js: https://nodejs.org/");
		process.exit(1);
	}
};

const runWithNode = async () => {
	const distPath = join(__dirname, "..", "dist", "index.js");
	if (!existsSync(distPath)) {
		throw new Error(
			"Compiled distribution not found. Reinstall ClaudeKit CLI or report a packaging issue.",
		);
	}

	const distUrl = pathToFileURL(distPath).href;
	await import(distUrl);
};

const main = async () => {
	checkNodeVersion();

	try {
		await runWithNode();
	} catch (err) {
		console.error(`[X] Failed to run CLI: ${getErrorMessage(err)}`);
		console.error("Please report this issue at: https://github.com/mrgoonie/claudekit-cli/issues");
		process.exit(1);
	}
};

main();
