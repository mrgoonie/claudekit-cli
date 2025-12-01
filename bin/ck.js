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
 * Run CLI via Node.js as fallback (slower but works on all platforms)
 */
const runWithNode = async () => {
	// Dynamic import of the compiled dist or source
	const distPath = join(__dirname, "..", "dist", "index.js");
	if (existsSync(distPath)) {
		await import(distPath);
	} else {
		// Fallback to source (for development)
		const srcPath = join(__dirname, "..", "src", "index.ts");
		await import(srcPath);
	}
};

// Map to binary filename
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

const binaryPath = getBinaryPath();

// If no binary for this platform, use Node.js fallback
if (!binaryPath) {
	runWithNode().catch((err) => {
		console.error(`❌ Failed to run CLI: ${err.message}`);
		process.exit(1);
	});
} else if (!existsSync(binaryPath)) {
	// Binary should exist but doesn't - try fallback
	runWithNode().catch((err) => {
		console.error(`❌ Binary not found and fallback failed: ${err.message}`);
		console.error("Please report this issue at: https://github.com/mrgoonie/claudekit-cli/issues");
		process.exit(1);
	});
} else {
	// Execute the binary with all arguments
	const child = spawn(binaryPath, process.argv.slice(2), {
		stdio: "inherit",
		windowsHide: true,
	});

	child.on("error", (err) => {
		// Binary execution failed (e.g., ENOENT on Alpine/musl due to missing glibc)
		// Fall back to Node.js execution
		runWithNode().catch((fallbackErr) => {
			console.error(`❌ Binary failed: ${err.message}`);
			console.error(`❌ Fallback also failed: ${fallbackErr.message}`);
			console.error(
				"Please report this issue at: https://github.com/mrgoonie/claudekit-cli/issues",
			);
			process.exit(1);
		});
	});

	child.on("exit", (code, signal) => {
		if (signal) {
			process.kill(process.pid, signal);
		}
		process.exit(code || 0);
	});
}
