#!/usr/bin/env bun

/**
 * Build platform-specific binaries for distribution
 * This script creates the appropriate binary files for each platform
 */

import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const binDir = join(rootDir, "bin");

// Ensure bin directory exists
if (!existsSync(binDir)) {
	mkdirSync(binDir, { recursive: true });
}

// Build the main binary first
console.log("🔨 Building main binary...");
execSync("bun run compile", { cwd: rootDir, stdio: "inherit" });

// Platform-specific binary mapping
const platforms = [
	{ name: "darwin-arm64", ext: "" },
	{ name: "darwin-x64", ext: "" },
	{ name: "linux-x64", ext: "" },
	{ name: "win32-x64", ext: ".exe" },
];

console.log("📦 Creating platform-specific binaries...");

// For now, we'll create the current platform binary
// In a CI/CD environment, this would run for each target platform
const currentPlatform = process.platform;
const currentArch = process.arch;

let platformName;
if (currentPlatform === "darwin") {
	platformName = `darwin-${currentArch}`;
} else if (currentPlatform === "linux") {
	platformName = `linux-${currentArch}`;
} else if (currentPlatform === "win32") {
	platformName = `win32-${currentArch}`;
} else {
	console.error(`❌ Unsupported platform: ${currentPlatform}-${currentArch}`);
	process.exit(1);
}

const platform = platforms.find((p) => p.name === platformName);
if (!platform) {
	console.error(`❌ Platform not found in mapping: ${platformName}`);
	process.exit(1);
}

const sourceBinary = join(rootDir, "ck");
const targetBinary = join(binDir, `ck-${platformName}${platform.ext}`);

console.log(`📋 Copying ${sourceBinary} -> ${targetBinary}`);
copyFileSync(sourceBinary, targetBinary);

// Make it executable on Unix-like systems
if (currentPlatform !== "win32") {
	execSync(`chmod +x ${targetBinary}`, { stdio: "inherit" });
}

console.log("✅ Platform binaries built successfully!");