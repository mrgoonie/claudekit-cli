#!/usr/bin/env node

/**
 * Pre-commit hook to check if binary versions are in sync with package.json
 */

import { execSync } from "node:child_process";
import fs from "node:fs";

const SEMVER_PATTERN = /\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/;

function validatePackageVersion() {
	try {
		const content = fs.readFileSync("package.json", "utf8");
		const packageJson = JSON.parse(content);

		if (!packageJson.version || typeof packageJson.version !== "string") {
			throw new Error("package.json missing or invalid version field");
		}

		if (!SEMVER_PATTERN.test(packageJson.version)) {
			throw new Error("Invalid version format in package.json");
		}

		return packageJson.version;
	} catch (error) {
		console.error(`❌ Could not validate package.json: ${error.message}`);
		process.exit(1);
	}
}

function getBinaryVersion(binaryPath) {
	const platform = process.platform;
	const arch = process.arch;

	// Skip binaries that can't run on current platform
	if (platform === "linux" && binaryPath.includes("darwin")) return null;
	if (platform === "linux" && binaryPath.includes("win32")) return null;
	if (platform === "darwin" && binaryPath.includes("win32")) return null;
	if (platform === "darwin" && binaryPath.includes("linux")) return null;
	if (platform === "win32" && !binaryPath.includes("win32")) return null;

	// Skip if architecture doesn't match (for non-universal binaries)
	if (arch === "arm64" && binaryPath.includes("x64") && !binaryPath.includes("win32")) return null;
	if (arch === "x64" && binaryPath.includes("arm64")) return null;

	try {
		const output = execSync(`${binaryPath} --version`, { encoding: "utf8" });
		const match = output.match(SEMVER_PATTERN);
		return match ? match[0] : null;
	} catch (error) {
		return null;
	}
}

function main() {
	const packageVersion = validatePackageVersion();
	console.log(`🔍 Checking binary versions against package.json version: ${packageVersion}`);

	const binaries = [
		"bin/ck-darwin-arm64",
		"bin/ck-darwin-x64",
		"bin/ck-linux-x64",
		"bin/ck-win32-x64.exe",
	];

	let allSynced = true;
	const errors = [];
	const missingBinaries = [];

	for (const binary of binaries) {
		if (fs.existsSync(binary)) {
			const binaryVersion = getBinaryVersion(binary);
			if (binaryVersion === null) {
				console.log(`⚠️  Could not get version from ${binary}`);
				continue;
			}

			if (binaryVersion !== packageVersion) {
				allSynced = false;
				errors.push(`${binary}: ${binaryVersion} (expected ${packageVersion})`);
				console.log(`❌ ${binary} version mismatch: ${binaryVersion} != ${packageVersion}`);
			} else {
				console.log(`✅ ${binary}: ${binaryVersion}`);
			}
		} else {
			allSynced = false;
			missingBinaries.push(binary);
			console.log(`❌ Binary not found: ${binary}`);
		}
	}

	if (!allSynced) {
		console.log("\n❌ Version synchronization issues detected:");
		if (missingBinaries.length > 0) {
			missingBinaries.forEach((binary) => console.log(`   - Missing binary: ${binary}`));
		}
		errors.forEach((error) => console.log(`   - ${error}`));
		console.log("\n💡 To fix this, run:");
		console.log("   bun run compile:binaries");
		console.log(
			"   bun run scripts/compile-binary.ts --outfile bin/ck-darwin-arm64 --target bun-darwin-arm64",
		);
		console.log(
			"   bun run scripts/compile-binary.ts --outfile bin/ck-darwin-x64 --target bun-darwin-x64",
		);
		console.log(
			"   bun run scripts/compile-binary.ts --outfile bin/ck-linux-x64 --target bun-linux-x64-baseline",
		);
		console.log(
			"   bun run scripts/compile-binary.ts --outfile bin/ck-win32-x64.exe --target bun-win32-x64",
		);
		process.exit(1);
	}

	console.log("✅ All binary versions are in sync with package.json");
}

main();
