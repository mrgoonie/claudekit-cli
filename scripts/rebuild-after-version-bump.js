/**
 * Semantic-release prepare plugin — rebuilds dist bundle and dashboard UI
 * after version bump so the published npm package embeds the correct version.
 *
 * Bun inlines package.json at build time. Without this plugin, `ck --version`
 * would report the pre-bump version.
 */

import { execSync } from "node:child_process";

export async function prepare(_pluginConfig, context) {
	const { logger } = context;

	logger.log("Rebuilding dist bundle with bumped version...");
	execSync("bun run build", { stdio: "inherit" });

	logger.log("Rebuilding dashboard UI...");
	execSync("bun run ui:build", { stdio: "inherit" });

	logger.log("Rebuild complete — dist now embeds correct version.");
}
