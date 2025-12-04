#!/usr/bin/env node

/**
 * Wrapper script that detects platform and executes the correct binary.
 * Falls back to Node.js execution if binary fails (e.g., Alpine/musl).
 * This is the entry point that NPM symlinks to when installing globally.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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
 * Run CLI via Node.js as fallback (slower but works on all platforms).
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
			// Fall back to Node.js execution
			errorOccurred = true;
			try {
				await runWithNode(true);
				resolve();
			} catch (fallbackErr) {
				console.error(`❌ Binary failed: ${getErrorMessage(err)}`);
				console.error(`❌ Fallback also failed: ${getErrorMessage(fallbackErr)}`);
				console.error(
					"Please report this issue at: https://github.com/mrgoonie/claudekit-cli/issues",
				);
				process.exit(1);
			}
		});

		child.on("exit", (code, signal) => {
			// Don't handle exit if error handler is managing fallback
			if (errorOccurred) return;

			if (signal) {
				process.kill(process.pid, signal);
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
 * Handle fallback execution with error reporting
 * @param {string} errorPrefix - Prefix for error message if fallback fails
 * @param {boolean} showIssueLink - Whether to show issue reporting link
 */
const handleFallback = async (errorPrefix, showIssueLink = false) => {
	try {
		await runWithNode();
	} catch (err) {
		console.error(`❌ ${errorPrefix}: ${getErrorMessage(err)}`);
		if (showIssueLink) {
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

	if (!binaryPath) {
		// No binary for this platform - use Node.js fallback
		await handleFallback("Failed to run CLI");
	} else if (!existsSync(binaryPath)) {
		// Binary should exist but doesn't - try fallback
		await handleFallback("Binary not found and fallback failed", true);
	} else {
		// Execute the binary (handles its own fallback on error)
		await runBinary(binaryPath);
	}
};

main();
