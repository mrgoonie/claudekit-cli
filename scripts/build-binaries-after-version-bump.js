#!/usr/bin/env node

/**
 * Semantic Release Plugin
 * Builds dist bundle and platform binaries before npm publish.
 * This plugin runs BEFORE @semantic-release/npm, so we must:
 * 1. Update package.json version first (so binaries embed correct version)
 * 2. Build dist/index.js (Node.js fallback)
 * 3. Build platform binaries
 */

import { execSync } from "node:child_process";
import fs from "node:fs";

async function prepare(pluginConfig, context) {
	const { logger, nextRelease, branch } = context;
	const { version } = nextRelease;
	const branchName = (branch?.name || "").toLowerCase();
	const isDevRelease = branchName === "dev";

	logger.log(`Building for version ${version}...`);
	if (isDevRelease) {
		logger.log("Dev branch detected - skipping platform binaries (npm-only release)");
	}

	const failedPlatforms = [];

	try {
		// Step 1: Update package.json version BEFORE building
		// This ensures binaries embed the correct version number
		logger.log(`Updating package.json to version ${version}...`);
		const packageJsonPath = "package.json";

		let packageJson;
		try {
			const content = fs.readFileSync(packageJsonPath, "utf8");
			packageJson = JSON.parse(content);
		} catch (readError) {
			throw new Error(`Failed to read/parse package.json: ${readError.message}`);
		}

		packageJson.version = version;

		try {
			fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, "\t")}\n`);
		} catch (writeError) {
			throw new Error(`Failed to write package.json: ${writeError.message}`);
		}
		logger.log(`✅ package.json updated to ${version}`);

		// Step 2: Build dist/index.js (Node.js fallback bundle)
		logger.log("Building dist/index.js...");
		execSync("bun run build", { stdio: "inherit" });

		// Validate dist/index.js was created and is non-empty
		const distPath = "dist/index.js";
		if (!fs.existsSync(distPath)) {
			throw new Error("Build failed: dist/index.js not created");
		}
		const distStats = fs.statSync(distPath);
		if (distStats.size < 1000) {
			throw new Error(`Build failed: dist/index.js too small (${distStats.size} bytes)`);
		}
		logger.log(`✅ dist/index.js built (${Math.round(distStats.size / 1024)}KB)`);

		// Step 3: Build platform binaries (skip for dev releases)
		if (!isDevRelease) {
			// Ensure bin directory exists
			if (!fs.existsSync("bin")) {
				fs.mkdirSync("bin", { recursive: true });
			}

			// Build binary for current platform (Linux CI)
			logger.log("Building Linux x64 binary...");
			try {
				execSync("bun build src/index.ts --compile --outfile bin/ck-linux-x64", {
					stdio: "inherit",
				});
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
		}

		// Verify essential files exist before npm publish
		logger.log("Verifying essential files for npm package...");
		const essentialFiles = [
			{ path: "dist/index.js", desc: "Node.js fallback bundle" },
			{ path: "bin/ck.js", desc: "CLI entry point" },
		];

		// Add binary checks only for production releases
		if (!isDevRelease) {
			essentialFiles.push(
				{ path: "bin/ck-linux-x64", desc: "Linux binary" },
				{ path: "bin/ck-darwin-arm64", desc: "macOS ARM binary" },
				{ path: "bin/ck-darwin-x64", desc: "macOS x64 binary" },
				{ path: "bin/ck-win32-x64.exe", desc: "Windows binary" },
			);
		}

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
