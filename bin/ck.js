#!/usr/bin/env node

/**
 * Wrapper script that detects platform and executes the correct binary
 * This is the entry point that NPM symlinks to when installing globally
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Detect platform and architecture
const platform = process.platform;
const arch = process.arch;

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
		console.error(`❌ Unsupported platform: ${platform}-${arch}`);
		console.error("Supported platforms: macOS (arm64, x64), Linux (x64), Windows (x64)");
		process.exit(1);
	}

	return join(__dirname, binaryName);
};

const binaryPath = getBinaryPath();

// Check if binary exists
if (!existsSync(binaryPath)) {
	console.error(`❌ Binary not found: ${binaryPath}`);
	console.error("Please report this issue at: https://github.com/claudekit/claudekit-cli/issues");
	process.exit(1);
}

// Execute the binary with all arguments
const child = spawn(binaryPath, process.argv.slice(2), {
	stdio: "inherit",
	windowsHide: true,
});

child.on("exit", (code, signal) => {
	if (signal) {
		process.kill(process.pid, signal);
	}
	process.exit(code || 0);
});
