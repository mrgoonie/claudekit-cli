#!/usr/bin/env node

/**
 * Build all platform binaries with current package.json version
 */

import { execFileSync, execSync } from "node:child_process";
import fs from "node:fs";

function validatePackageVersion() {
	try {
		const content = fs.readFileSync("package.json", "utf8");
		const packageJson = JSON.parse(content);

		if (!packageJson.version || typeof packageJson.version !== "string") {
			throw new Error("package.json missing or invalid version field");
		}

		if (!/^\d+\.\d+\.\d+/.test(packageJson.version)) {
			throw new Error("Invalid version format in package.json");
		}

		return packageJson.version;
	} catch (error) {
		console.error(`❌ Could not validate package.json: ${error.message}`);
		process.exit(1);
	}
}

function ensureUiDist() {
	if (!fs.existsSync("dist/ui/index.html")) {
		console.log("📦 Building UI assets...");
		execSync("bun run ui:build", { stdio: "inherit" });
	}
	if (!fs.existsSync("dist/ui/index.html")) {
		console.error("❌ dist/ui/index.html not found after ui:build. Cannot embed UI in binary.");
		process.exit(1);
	}
}

function parseArgs(argv) {
	const args = new Set(argv);
	return {
		currentPlatformOnly: args.has("--current-platform-only"),
	};
}

function formatFileSize(bytes) {
	const units = ["B", "KB", "MB", "GB"];
	let value = bytes;
	let unitIndex = 0;

	while (value >= 1024 && unitIndex < units.length - 1) {
		value /= 1024;
		unitIndex += 1;
	}

	return `${value.toFixed(unitIndex === 0 ? 0 : 1)}${units[unitIndex]}`;
}

function logGeneratedBinaries() {
	console.log("\n📁 Generated binaries:");
	for (const file of fs.readdirSync("bin").sort()) {
		const path = `bin/${file}`;
		const stats = fs.statSync(path);
		if (!stats.isFile()) {
			continue;
		}
		console.log(`  ${file.padEnd(20)} ${formatFileSize(stats.size)}`);
	}
}

function main() {
	const { currentPlatformOnly } = parseArgs(process.argv.slice(2));
	const version = validatePackageVersion();
	console.log(`🔨 Building all binaries for version ${version}...`);
	const currentPlatform = `${process.platform}-${process.arch}`;
	const failedPlatforms = [];

	// Ensure UI dist exists for embedding
	ensureUiDist();

	// Ensure bin directory exists
	if (!fs.existsSync("bin")) {
		fs.mkdirSync("bin", { recursive: true });
	}

	const platforms = [
		{
			name: "darwin-arm64",
			target: "bun-darwin-arm64",
			output: "bin/ck-darwin-arm64",
			ext: "",
		},
		{
			name: "darwin-x64",
			target: "bun-darwin-x64",
			output: "bin/ck-darwin-x64",
			ext: "",
		},
		{
			name: "linux-x64",
			target: "bun-linux-x64",
			output: "bin/ck-linux-x64",
			ext: "",
		},
		{
			name: "win32-x64",
			target: "bun-win32-x64",
			output: "bin/ck-win32-x64.exe",
			ext: ".exe",
		},
	];

	const selectedPlatforms = currentPlatformOnly
		? platforms.filter((platform) => platform.name === currentPlatform)
		: platforms;

	if (selectedPlatforms.length === 0) {
		console.error(`❌ No binary target matches current platform ${currentPlatform}`);
		process.exit(1);
	}

	if (currentPlatformOnly) {
		console.log(`🎯 Building current platform only: ${currentPlatform}`);
	}

	for (const platform of selectedPlatforms) {
		console.log(`\n📦 Building ${platform.name}...`);
		try {
			execSync(
				`bun run scripts/compile-binary.ts --outfile ${platform.output} --target ${platform.target}`,
				{ stdio: "inherit" },
			);

			if (!platform.ext) {
				fs.chmodSync(platform.output, 0o755);
			}

			if (platform.name === currentPlatform) {
				const output = execFileSync(platform.output, ["--version"], { encoding: "utf8" });
				if (output.includes(version)) {
					console.log(`✅ ${platform.name}: ${output.trim()}`);
				} else {
					failedPlatforms.push(platform.name);
					console.log(
						`❌ ${platform.name}: Version mismatch. Expected: ${version}, Got: ${output.trim()}`,
					);
				}
			} else {
				console.log(
					`ℹ️  ${platform.name}: Built successfully, runtime check skipped on ${currentPlatform}`,
				);
			}
		} catch (error) {
			failedPlatforms.push(platform.name);
			console.log(`❌ Failed to build ${platform.name}: ${error.message}`);
		}
	}

	if (failedPlatforms.length > 0) {
		logGeneratedBinaries();
		console.error(
			`\n❌ Binary compilation failed for platform(s): ${Array.from(new Set(failedPlatforms)).join(", ")}`,
		);
		process.exit(1);
	}

	console.log("\n✅ Binary compilation completed");
	logGeneratedBinaries();
}

main();
