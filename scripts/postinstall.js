#!/usr/bin/env node

/**
 * Post-install script to copy the correct platform-specific binary
 * This runs after `npm install` to set up the executable
 */

import { chmodSync, copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const binDir = join(__dirname, "..", "bin");

// Detect platform and architecture
const platform = process.platform; // darwin, linux, win32
const arch = process.arch; // arm64, x64

// Map to binary filename
const getBinaryName = () => {
	const ext = platform === "win32" ? ".exe" : "";

	// Map platform-arch combinations to binary names
	const binaryMap = {
		"darwin-arm64": `ck-darwin-arm64${ext}`,
		"darwin-x64": `ck-darwin-x64${ext}`,
		"linux-x64": `ck-linux-x64${ext}`,
		// "linux-arm64": `ck-linux-arm64${ext}`, // Not yet supported
		"win32-x64": `ck-win32-x64${ext}`,
	};

	const key = `${platform}-${arch}`;
	return binaryMap[key];
};

const binaryName = getBinaryName();

if (!binaryName) {
	console.error(`❌ Unsupported platform: ${platform}-${arch}`);
	console.error("Supported platforms: macOS (arm64, x64), Linux (x64, arm64), Windows (x64)");
	process.exit(1);
}

const sourceBinary = join(binDir, binaryName);
const targetBinary = join(binDir, platform === "win32" ? "ck.exe" : "ck");

// Check if platform-specific binary exists
if (!existsSync(sourceBinary)) {
	console.error(`❌ Binary not found: ${sourceBinary}`);
	console.error("This might be a packaging issue. Please report this at:");
	console.error("https://github.com/claudekit/claudekit-cli/issues");
	process.exit(1);
}

try {
	// Copy the binary
	copyFileSync(sourceBinary, targetBinary);

	// Make it executable (Unix-like systems)
	if (platform !== "win32") {
		chmodSync(targetBinary, 0o755);
	}

	console.log(`✅ claudekit-cli installed for ${platform}-${arch}`);
} catch (error) {
	console.error(`❌ Failed to install binary: ${error.message}`);
	process.exit(1);
}
