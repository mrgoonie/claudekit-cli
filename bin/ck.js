#!/usr/bin/env node

/**
 * Wrapper script that detects platform and executes the correct binary.
 * Falls back to Node.js execution if binary fails (e.g., Alpine/musl).
 * This is the entry point that NPM symlinks to when installing globally.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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
 * Run CLI via Node.js as fallback (slower but works on all platforms)
 * @param {boolean} showWarning - Whether to show fallback warning message
 */
const runWithNode = async (showWarning = false) => {
	const distPath = join(__dirname, "..", "dist", "index.js");
	if (!existsSync(distPath)) {
		throw new Error("Compiled distribution not found. This may indicate a packaging issue.");
	}
	if (showWarning) {
		console.error("⚠️  Native binary failed, using Node.js fallback (slower startup)");
	}
	await import(distPath);
};

/**
 * Map platform/arch to binary filename
 */
const getBinaryPath = () => {
	const ext = platform === "win32" ? ".exe" : "";

	const binaryMap = {
		"darwin-arm64": `ck-darwin-arm64${ext}`,
		"darwin-x64": `ck-darwin-x64${ext}`,
		"linux-x64": `ck-linux-x64${ext}`,
		"win32-x64": `ck-win32-x64${ext}`,
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
			}
			process.exit(code || 0);
		});
	});
};

/**
 * Main execution - determine which path to take
 */
const main = async () => {
	const binaryPath = getBinaryPath();

	if (!binaryPath) {
		// No binary for this platform - use Node.js fallback
		try {
			await runWithNode();
		} catch (err) {
			console.error(`❌ Failed to run CLI: ${getErrorMessage(err)}`);
			process.exit(1);
		}
	} else if (!existsSync(binaryPath)) {
		// Binary should exist but doesn't - try fallback
		try {
			await runWithNode();
		} catch (err) {
			console.error(`❌ Binary not found and fallback failed: ${getErrorMessage(err)}`);
			console.error(
				"Please report this issue at: https://github.com/mrgoonie/claudekit-cli/issues",
			);
			process.exit(1);
		}
	} else {
		// Execute the binary (handles its own fallback on error)
		await runBinary(binaryPath);
	}
};

main();
