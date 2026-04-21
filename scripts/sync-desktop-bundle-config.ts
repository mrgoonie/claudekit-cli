import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
	loadDesktopBundleConfig,
	parseDesktopReleaseVersion,
	synchronizeDesktopBundleConfig,
	validateDesktopBundleConfig,
} from "../src/domains/desktop/desktop-bundle-version.js";

const CONFIG_PATH = fileURLToPath(new URL("../src-tauri/tauri.conf.json", import.meta.url));

async function main(): Promise<void> {
	const current = await loadDesktopBundleConfig(CONFIG_PATH);
	const args = process.argv.slice(2);
	const checkOnly = args.includes("--check");
	const inputArg = args.find((arg) => arg !== "--check");
	const rawInput =
		inputArg ||
		(checkOnly
			? current.version
			: process.env.DESKTOP_RELEASE_VERSION || process.env.GITHUB_REF_NAME);
	if (!rawInput) {
		throw new Error(
			"Usage: bun scripts/sync-desktop-bundle-config.ts [--check] <desktop-vX.Y.Z | X.Y.Z>",
		);
	}

	const appVersion = parseDesktopReleaseVersion(rawInput);
	const updated = synchronizeDesktopBundleConfig(current, appVersion);
	const changed =
		current.version !== updated.version ||
		current.bundle.windows.wix.version !== updated.bundle.windows.wix.version;

	if (changed) {
		if (checkOnly) {
			throw new Error(
				`Desktop bundle config is out of sync for app version ${appVersion}; run bun run desktop:sync-version "${appVersion}"`,
			);
		}

		const rawConfig = JSON.parse(await readFile(CONFIG_PATH, "utf8")) as {
			version?: string;
			bundle?: {
				windows?: {
					wix?: {
						version?: string;
					};
				};
			};
		};
		rawConfig.version = updated.version;
		rawConfig.bundle ??= {};
		rawConfig.bundle.windows ??= {};
		rawConfig.bundle.windows.wix ??= {};
		rawConfig.bundle.windows.wix.version = updated.bundle.windows.wix.version;
		await writeFile(CONFIG_PATH, `${JSON.stringify(rawConfig, null, "\t")}\n`);
	}

	const validated = validateDesktopBundleConfig(updated);
	const prefix = checkOnly ? "verified" : changed ? "synced" : "already";
	console.log(
		`[desktop-config] ${prefix} at app version ${validated.appVersion} -> wix.version ${validated.expectedWixVersion}`,
	);
}

main().catch((error) => {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`[desktop-config] ${message}`);
	process.exitCode = 1;
});
