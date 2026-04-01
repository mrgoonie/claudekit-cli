/**
 * Semantic-release prepare plugin — synchronizes package.json to the next
 * release version, rebuilds dist bundle and dashboard UI, then verifies the
 * packed npm artifact embeds the same version.
 *
 * Bun inlines package.json at build time. In semantic-release, this custom
 * plugin runs before @semantic-release/npm prepares the final tarball, so it
 * must write nextRelease.version itself before rebuilding.
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const PACKAGE_JSON_PATH = resolve(process.cwd(), "package.json");

export function synchronizePackageJsonVersion(version, packageJsonPath = PACKAGE_JSON_PATH) {
	const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
	if (packageJson.version === version) {
		return false;
	}

	packageJson.version = version;
	writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, "\t")}\n`);
	return true;
}

export async function prepare(_pluginConfig, context) {
	const { logger, nextRelease } = context;
	const nextVersion = nextRelease?.version?.trim();
	if (!nextVersion) {
		throw new Error("semantic-release did not provide nextRelease.version");
	}

	const updated = synchronizePackageJsonVersion(nextVersion);
	if (updated) {
		logger.log(`Synchronized package.json version to ${nextVersion} before rebuild.`);
	} else {
		logger.log(`package.json already at ${nextVersion} before rebuild.`);
	}

	logger.log("Rebuilding dist bundle with bumped version...");
	execSync("bun run build", { stdio: "inherit" });

	logger.log("Rebuilding dashboard UI...");
	execSync("bun run ui:build", { stdio: "inherit" });

	logger.log("Verifying packed release bundle after rebuild...");
	execSync(`node scripts/prepublish-check.js --expected-version="${nextVersion}"`, {
		stdio: "inherit",
	});

	logger.log("Rebuild complete — dist now embeds correct version.");
}
