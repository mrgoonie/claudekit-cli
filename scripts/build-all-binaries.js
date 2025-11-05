#!/usr/bin/env node

/**
 * Build all platform binaries with current package.json version
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
		console.error(`❌ Could not validate package.json: ${error.message}`);
		process.exit(1);
	}
}

function main() {
	const version = validatePackageVersion();
	console.log(`🔨 Building all binaries for version ${version}...`);

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

	for (const platform of platforms) {
		console.log(`\n📦 Building ${platform.name}...`);
		try {
			execSync(
				`bun build src/index.ts --compile --target ${platform.target} --outfile ${platform.output}`,
				{ stdio: "inherit" },
			);

			if (!platform.ext) {
				execSync(`chmod +x ${platform.output}`, { stdio: "inherit" });
			}

			// Verify the binary
			const output = execSync(`${platform.output} --version`, { encoding: "utf8" });
			if (output.includes(version)) {
				console.log(`✅ ${platform.name}: ${output.trim()}`);
			} else {
				console.log(
					`⚠️  ${platform.name}: Version mismatch. Expected: ${version}, Got: ${output.trim()}`,
				);
			}
		} catch (error) {
			console.log(`❌ Failed to build ${platform.name}: ${error.message}`);
		}
	}

	console.log("\n✅ Binary compilation completed");
	console.log("\n📁 Generated binaries:");
	execSync("ls -lh bin/", { stdio: "inherit" });
}

main();
