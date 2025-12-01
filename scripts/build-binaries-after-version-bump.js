#!/usr/bin/env node

/**
 * Semantic Release Plugin
 * Rebuilds binaries after package.json version is bumped
 */

import { execSync } from "node:child_process";
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
		throw new Error(`Could not validate package.json: ${error.message}`);
	}
}

async function prepare(pluginConfig, context) {
	const { logger, nextRelease } = context;
	const { version } = nextRelease;

	logger.log(`Rebuilding binaries with version ${version}...`);

	// Validate version matches package.json
	const packageVersion = validatePackageVersion();
	if (packageVersion !== version) {
		throw new Error(`Version mismatch: package.json (${packageVersion}) vs release (${version})`);
	}

	const failedPlatforms = [];

	try {
		// Ensure bin directory exists
		if (!fs.existsSync("bin")) {
			fs.mkdirSync("bin", { recursive: true });
		}

		// Build binary for current platform (Linux CI)
		logger.log("Building Linux x64 binary...");
		try {
			execSync("bun build src/index.ts --compile --outfile bin/ck-linux-x64", { stdio: "inherit" });
			execSync("chmod +x bin/ck-linux-x64", { stdio: "inherit" });
		} catch (error) {
			failedPlatforms.push("linux-x64");
			logger.error(`Failed to build Linux x64 binary: ${error.message}`);
		}

		// Cross-compile for other platforms
		const platforms = [
			{ target: "darwin-arm64", output: "bin/ck-darwin-arm64" },
			{ target: "darwin-x64", output: "bin/ck-darwin-x64" },
			{ target: "win32-x64", output: "bin/ck-win32-x64.exe" },
		];

		for (const platform of platforms) {
			logger.log(`Building for ${platform.target}...`);
			try {
				execSync(
					`bun build src/index.ts --compile --target bun-${platform.target} --outfile ${platform.output}`,
					{ stdio: "inherit" },
				);
				if (!platform.output.endsWith(".exe")) {
					execSync(`chmod +x ${platform.output}`, { stdio: "inherit" });
				}
			} catch (error) {
				failedPlatforms.push(platform.target);
				logger.error(`Failed to build for ${platform.target}: ${error.message}`);
			}
		}

		// Verify the main binary shows correct version
		if (fs.existsSync("bin/ck-linux-x64")) {
			logger.log("Verifying binary version...");
			try {
				const output = execSync("./bin/ck-linux-x64 --version", { encoding: "utf8" });
				if (output.includes(version)) {
					logger.log(`✅ Binary version verification passed: ${version}`);
				} else {
					logger.warn(`⚠️ Binary version mismatch. Expected: ${version}, Got: ${output.trim()}`);
				}
			} catch (error) {
				logger.warn(`Could not verify binary version: ${error.message}`);
			}
		}

		// Fail if critical platforms failed
		if (failedPlatforms.length > 0) {
			throw new Error(`Binary build failed for platforms: ${failedPlatforms.join(", ")}`);
		}

		// Verify essential files exist before npm publish
		logger.log("Verifying essential files for npm package...");
		const essentialFiles = [
			{ path: "dist/index.js", desc: "Node.js fallback bundle" },
			{ path: "bin/ck.js", desc: "CLI entry point" },
		];
		for (const file of essentialFiles) {
			if (!fs.existsSync(file.path)) {
				throw new Error(`Missing essential file: ${file.path} (${file.desc})`);
			}
			logger.log(`✅ ${file.path} exists`);
		}

		logger.log("✅ Binary rebuild completed successfully");
	} catch (error) {
		logger.error(`❌ Failed to rebuild binaries: ${error.message}`);
		throw error;
	}
}

export { prepare };
