#!/usr/bin/env node

/**
 * CLI entry point — runs dist/index.js via Bun (preferred) or Node.js (fallback).
 * This is the file NPM symlinks to when installing globally.
 */

import { execSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Minimum required Node.js version (major.minor)
const MIN_NODE_VERSION = [18, 0];

/**
 * Check if the current Node.js version meets minimum requirements.
 * Required because dependencies like ora@8 use ES2022+ features.
 */
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

// Check Node.js version before proceeding
checkNodeVersion();

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Extract error message safely with type guard
 */
const getErrorMessage = (err) => {
	return err instanceof Error ? err.message : String(err);
};

/**
 * Check if bun runtime is available on the system.
 * dist/index.js may contain bun-specific imports (bun:sqlite) that Node.js can't handle.
 * Result is cached to avoid repeated execSync calls.
 */
let _bunAvailable = undefined;
const hasBun = () => {
	if (_bunAvailable !== undefined) return _bunAvailable;
	try {
		execSync("bun --version", { stdio: "ignore", timeout: 3000 });
		_bunAvailable = true;
	} catch {
		_bunAvailable = false;
	}
	return _bunAvailable;
};

let _installedVersion = undefined;
const readInstalledPackageVersion = () => {
	if (_installedVersion !== undefined) return _installedVersion;
	try {
		const packageJsonPath = join(__dirname, "..", "package.json");
		const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
		_installedVersion = typeof packageJson.version === "string" ? packageJson.version : null;
	} catch {
		_installedVersion = null;
	}
	return _installedVersion;
};

const isExpectedBunOnlyRelease = () => {
	const version = readInstalledPackageVersion();
	return typeof version === "string" && /-dev\.\d+$/i.test(version);
};

const shouldWarnForBunFallback = () => !isExpectedBunOnlyRelease();

/**
 * Run CLI via bun runtime. Preferred over Node.js when dist/index.js contains
 * bun-specific imports (e.g., bun:sqlite) that the Node.js ESM loader rejects.
 * Uses spawnSync to hand full terminal control to bun — this prevents Unicode
 * rendering issues (garbled @clack/prompts box-drawing chars) that occur when
 * bun runs as an async child of a Node.js parent process.
 * @param {boolean} showWarning - Whether to show runtime info message
 * @returns {boolean} true if bun ran successfully, false if spawn failed
 */
const runWithBun = (showWarning = false) => {
	const distPath = join(__dirname, "..", "dist", "index.js");
	if (!existsSync(distPath)) {
		throw new Error("Compiled distribution not found. This may indicate a packaging issue.");
	}
	if (showWarning) {
		console.error("[i] Using bun runtime");
	}
	const result = spawnSync("bun", [distPath, ...process.argv.slice(2)], {
		stdio: "inherit",
		windowsHide: true,
	});
	if (result.error) {
		// bun spawn failed (e.g., ENOENT) — caller handles fallback
		return false;
	}
	if (result.signal) {
		process.kill(process.pid, result.signal);
	}
	process.exit(result.status || 0);
};

/**
 * Run CLI via Node.js as last-resort fallback (slower, no bun: protocol support).
 * @param {boolean} showWarning - Whether to show fallback warning message
 */
const runWithNode = async (showWarning = false) => {
	const distPath = join(__dirname, "..", "dist", "index.js");
	if (!existsSync(distPath)) {
		throw new Error("Compiled distribution not found. This may indicate a packaging issue.");
	}
	if (showWarning) {
		console.error("[i] Using Node.js runtime (slower startup)");
	}
	const distUrl = pathToFileURL(distPath).href;
	try {
		await import(distUrl);
	} catch (importErr) {
		throw new Error(`Failed to load CLI module: ${getErrorMessage(importErr)}`);
	}
};

/**
 * Main execution — try Bun first, fall back to Node.js
 */
const main = async () => {
	const showBunWarning = shouldWarnForBunFallback();

	// Prefer bun — dist/index.js may contain bun-specific imports (bun:sqlite)
	if (hasBun()) {
		const bunOk = runWithBun(false);
		if (!bunOk && showBunWarning) {
			console.error("[i] Bun spawn failed, falling back to Node.js");
		}
	}

	// Last resort: Node.js (works for stable builds without bun: imports)
	try {
		await runWithNode(showBunWarning);
	} catch (err) {
		const errMsg = getErrorMessage(err);
		console.error(`[X] Failed to run CLI: ${errMsg}`);
		if (errMsg.includes("bun:") || errMsg.includes("Received protocol")) {
			console.error("");
			console.error("This version of ClaudeKit CLI requires the bun runtime.");
			console.error("Install bun:  curl -fsSL https://bun.sh/install | bash");
			console.error("Or switch to stable:  npm install -g claudekit-cli@latest");
		} else {
			console.error(
				"Please report this issue at: https://github.com/mrgoonie/claudekit-cli/issues",
			);
		}
		process.exit(1);
	}
};

main();
