#!/usr/bin/env node

/**
 * Wrapper script that detects platform and executes the correct binary.
 * Falls back to Node.js execution if binary fails (e.g., Alpine/musl).
 * This is the entry point that NPM symlinks to when installing globally.
 */

import { execSync, spawn, spawnSync } from "node:child_process";
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
			`❌ Node.js ${MIN_NODE_VERSION.join(".")}+ is required. Current version: ${process.versions.node}`,
		);
		console.error("   Please upgrade Node.js: https://nodejs.org/");
		process.exit(1);
	}
};

// Check Node.js version before proceeding
checkNodeVersion();

const __dirname = dirname(fileURLToPath(import.meta.url));

// Detect platform and architecture
const platform = process.platform;
const arch = process.arch;

/**
 * Extract error message safely with type guard
 */
const getErrorMessage = (err) => {
	return err instanceof Error ? err.message : String(err);
};

/**
 * Check if bun runtime is available on the system.
 * Used to run dist/index.js with bun when no platform binary exists (e.g., dev releases).
 * dist/index.js may contain bun-specific imports (bun:sqlite) that Node.js can't handle.
 * Result is cached to avoid repeated execSync calls across fallback paths.
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
const RUNTIME_FATAL_SIGNALS = new Set(["SIGABRT", "SIGBUS", "SIGILL", "SIGSEGV", "SIGTRAP"]);

const handleRuntimeSignalExit = (signal, sourceLabel) => {
	if (!signal) return;
	if (!RUNTIME_FATAL_SIGNALS.has(signal)) {
		process.kill(process.pid, signal);
		return;
	}

	console.error(`❌ ${sourceLabel} crashed with ${signal}`);
	if (signal === "SIGILL") {
		console.error(
			"This usually means the bundled executable requires newer CPU instructions than this machine provides.",
		);
		console.error(
			"On Linux x64, install a release that includes the baseline-compatible binary build.",
		);
	} else {
		console.error("The bundled executable crashed before ClaudeKit could finish starting.");
	}
	console.error("If this persists, report it at: https://github.com/mrgoonie/claudekit-cli/issues");
	process.exit(1);
};

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
		console.error("⚠️  Native binary not found, using bun runtime");
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
		handleRuntimeSignalExit(result.signal, "Bun runtime");
	}
	process.exit(result.status || 0);
};

/**
 * Run CLI via Node.js as last-resort fallback (slower, no bun: protocol support).
 * The imported dist/index.js handles its own process lifecycle via the cac CLI framework.
 * @param {boolean} showWarning - Whether to show fallback warning message
 * @throws {Error} If dist/index.js is missing or fails to load
 */
const runWithNode = async (showWarning = false) => {
	const distPath = join(__dirname, "..", "dist", "index.js");
	if (!existsSync(distPath)) {
		throw new Error("Compiled distribution not found. This may indicate a packaging issue.");
	}
	if (showWarning) {
		console.error("⚠️  Native binary failed, using Node.js fallback (slower startup)");
	}
	// The CLI module handles process.exit() internally after command execution
	// Convert to file:// URL for cross-platform ESM compatibility (Windows paths require this)
	const distUrl = pathToFileURL(distPath).href;
	try {
		await import(distUrl);
	} catch (importErr) {
		throw new Error(`Failed to load CLI module: ${getErrorMessage(importErr)}`);
	}
};

/**
 * Map platform/arch to binary filename
 */
const getBinaryPath = () => {
	const binaryMap = {
		"darwin-arm64": "ck-darwin-arm64",
		"darwin-x64": "ck-darwin-x64",
		"linux-x64": "ck-linux-x64",
		"win32-x64": "ck-win32-x64.exe",
	};

	const key = `${platform}-${arch}`;
	const binaryName = binaryMap[key];

	if (!binaryName) {
		// Unsupported platform - try Node.js fallback
		return null;
	}

	return join(__dirname, binaryName);
};

/**
 * Execute binary with fallback to Node.js on failure.
 * Uses Promise-based approach to avoid race conditions between error and exit events.
 *
 * Note: This Promise intentionally never rejects - all error paths call process.exit()
 * directly since this is a CLI entry point. The Promise is used purely for async flow
 * control and race condition prevention, not for error propagation.
 *
 * @param {string} binaryPath - Path to the platform-specific binary
 * @returns {Promise<void>} Resolves when fallback completes (binary exit calls process.exit directly)
 */
const runBinary = (binaryPath) => {
	return new Promise((resolve) => {
		const child = spawn(binaryPath, process.argv.slice(2), {
			stdio: "inherit",
			windowsHide: true,
		});

		let errorOccurred = false;

		child.on("error", async (err) => {
			// Binary execution failed (e.g., ENOENT on Alpine/musl due to missing glibc)
			// Fall back to bun (exits process on success), then Node.js
			errorOccurred = true;
			if (hasBun()) {
				// runWithBun calls process.exit() on success — won't return here
				runWithBun(true);
			}
			try {
				await runWithNode(true);
				resolve();
			} catch (fallbackErr) {
				const fallbackMsg = getErrorMessage(fallbackErr);
				console.error(`❌ Binary failed: ${getErrorMessage(err)}`);
				console.error(`❌ Fallback also failed: ${fallbackMsg}`);
				if (fallbackMsg.includes("bun:") || fallbackMsg.includes("Received protocol")) {
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
		});

		child.on("exit", (code, signal) => {
			// Don't handle exit if error handler is managing fallback
			if (errorOccurred) return;

			if (signal) {
				handleRuntimeSignalExit(signal, "Native binary");
				return;
			}
			// Use exitCode instead of exit() for proper handle cleanup on Windows
			// This prevents libuv assertion failures on Node.js 23.x/24.x/25.x
			// See: https://github.com/nodejs/node/issues/56645
			process.exitCode = code || 0;
			resolve();
		});
	});
};

/**
 * Handle fallback execution: try bun first (handles bun: imports), then Node.js.
 * @param {string} errorPrefix - Prefix for error message if all fallbacks fail
 * @param {boolean} showIssueLink - Whether to show issue reporting link
 */
const handleFallback = async (errorPrefix, showIssueLink = false, showBunWarning = true) => {
	// Prefer bun — dist/index.js may contain bun-specific imports (bun:sqlite)
	// runWithBun calls process.exit() on success — won't return here
	if (hasBun()) {
		runWithBun(showBunWarning);
	}
	// Last resort: Node.js (works for stable builds without bun: imports)
	try {
		await runWithNode();
	} catch (err) {
		const errMsg = getErrorMessage(err);
		console.error(`❌ ${errorPrefix}: ${errMsg}`);
		// Detect bun-specific import failures and guide user to install bun
		if (errMsg.includes("bun:") || errMsg.includes("Received protocol")) {
			console.error("");
			console.error("This version of ClaudeKit CLI requires the bun runtime.");
			console.error("Install bun:  curl -fsSL https://bun.sh/install | bash");
			console.error("Or switch to stable:  npm install -g claudekit-cli@latest");
		} else if (showIssueLink) {
			console.error(
				"Please report this issue at: https://github.com/mrgoonie/claudekit-cli/issues",
			);
		}
		process.exit(1);
	}
};

/**
 * Main execution - determine which path to take
 */
const main = async () => {
	const binaryPath = getBinaryPath();
	const showBunWarning = shouldWarnForBunFallback();

	if (!binaryPath) {
		// No binary for this platform - use Node.js fallback
		await handleFallback("Failed to run CLI", false, showBunWarning);
	} else if (!existsSync(binaryPath)) {
		// Binary should exist but doesn't - try fallback
		await handleFallback("Binary not found and fallback failed", true, showBunWarning);
	} else {
		// Execute the binary (handles its own fallback on error)
		await runBinary(binaryPath);
	}
};

main();
