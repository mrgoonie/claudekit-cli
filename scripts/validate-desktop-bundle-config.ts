import { fileURLToPath } from "node:url";
import {
	loadDesktopBundleConfig,
	validateDesktopBundleConfig,
} from "../src/domains/desktop/desktop-bundle-version.js";

const CONFIG_PATH = fileURLToPath(new URL("../src-tauri/tauri.conf.json", import.meta.url));

try {
	const config = await loadDesktopBundleConfig(CONFIG_PATH);
	const result = validateDesktopBundleConfig(config);
	console.log(
		`[desktop-config] app version ${result.appVersion} -> wix.version ${result.expectedWixVersion}`,
	);
} catch (error) {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`[desktop-config] ${message}`);
	process.exitCode = 1;
}
