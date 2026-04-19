import { readFile } from "node:fs/promises";
import semver from "semver";
import { z } from "zod";

const DesktopBundleConfigSchema = z.object({
	version: z.string().min(1),
	bundle: z
		.object({
			windows: z
				.object({
					wix: z
						.object({
							version: z.string().min(1),
						})
						.optional(),
				})
				.optional(),
		})
		.optional(),
});

type DesktopBundleConfig = z.infer<typeof DesktopBundleConfigSchema>;

export function deriveWindowsWixVersion(appVersion: string): string {
	const parsed = semver.parse(appVersion);
	if (!parsed) {
		throw new Error(`Desktop app version must be valid semver: ${appVersion}`);
	}

	if (parsed.major > 255 || parsed.minor > 255 || parsed.patch > 65_535) {
		throw new Error(
			`Desktop app version ${appVersion} exceeds Windows MSI numeric limits (255.255.65535)`,
		);
	}

	if (parsed.prerelease.length === 0) {
		return `${parsed.major}.${parsed.minor}.${parsed.patch}.0`;
	}

	const numericSegment = [...parsed.prerelease]
		.reverse()
		.find((segment): segment is number => typeof segment === "number");

	if (numericSegment === undefined || numericSegment > 65_535) {
		throw new Error(
			`Desktop app version ${appVersion} needs a numeric prerelease segment <= 65535 for Windows MSI`,
		);
	}

	return `${parsed.major}.${parsed.minor}.${parsed.patch}.${numericSegment}`;
}

export function validateDesktopBundleConfig(config: DesktopBundleConfig): {
	appVersion: string;
	expectedWixVersion: string;
	actualWixVersion: string | null;
} {
	const appVersion = config.version;
	const expectedWixVersion = deriveWindowsWixVersion(appVersion);
	const actualWixVersion = config.bundle?.windows?.wix?.version ?? null;

	if (actualWixVersion !== expectedWixVersion) {
		throw new Error(
			`Desktop Windows MSI version mismatch: tauri.conf version ${appVersion} requires bundle.windows.wix.version ${expectedWixVersion}, found ${actualWixVersion ?? "missing"}`,
		);
	}

	return {
		appVersion,
		expectedWixVersion,
		actualWixVersion,
	};
}

export async function loadDesktopBundleConfig(configPath: string): Promise<DesktopBundleConfig> {
	const raw = await readFile(configPath, "utf8");
	return DesktopBundleConfigSchema.parse(JSON.parse(raw));
}
