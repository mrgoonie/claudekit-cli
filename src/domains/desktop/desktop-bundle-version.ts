import { readFile } from "node:fs/promises";
import semver from "semver";
import { z } from "zod";

const WINDOWS_MSI_PATCH_STRIDE = 512;
const WINDOWS_MSI_STABLE_SLOT = 511;
const WINDOWS_MSI_PATCH_LIMIT = 127;
const WINDOWS_MSI_PRERELEASE_LIMIT = 126;
const WINDOWS_MSI_PRERELEASE_BASES = {
	dev: 0,
	alpha: 128,
	beta: 256,
	rc: 384,
} as const;

const DesktopBundleConfigSchema = z
	.object({
		version: z.string().min(1),
		bundle: z
			.object({
				windows: z
					.object({
						wix: z
							.object({
								version: z.string().min(1),
							})
							.passthrough(),
					})
					.passthrough(),
			})
			.passthrough(),
	})
	.passthrough();

export type DesktopBundleConfig = z.infer<typeof DesktopBundleConfigSchema>;

function normalizeWindowsWixVersion(version: string): string {
	return /^\d+\.\d+\.\d+\.0$/.test(version) ? version.slice(0, -2) : version;
}

function windowsWixVersionsMatch(actualVersion: string, expectedVersion: string): boolean {
	return normalizeWindowsWixVersion(actualVersion) === expectedVersion;
}

export function parseDesktopReleaseVersion(input: string): string {
	const trimmed = input.trim();
	if (trimmed.startsWith("desktop-v")) {
		return trimmed.slice("desktop-v".length);
	}
	return trimmed;
}

export function deriveWindowsWixVersion(appVersion: string): string {
	const parsed = semver.parse(appVersion);
	if (!parsed) {
		throw new Error(`Desktop app version must be valid semver: ${appVersion}`);
	}

	if (parsed.major > 255 || parsed.minor > 255 || parsed.patch > WINDOWS_MSI_PATCH_LIMIT) {
		throw new Error(
			`Desktop app version ${appVersion} exceeds the supported Windows MSI range (major <= 255, minor <= 255, patch <= ${WINDOWS_MSI_PATCH_LIMIT})`,
		);
	}

	const patchWindow = parsed.patch * WINDOWS_MSI_PATCH_STRIDE;

	if (parsed.prerelease.length === 0) {
		return `${parsed.major}.${parsed.minor}.${patchWindow + WINDOWS_MSI_STABLE_SLOT}`;
	}

	const prereleaseLabel =
		parsed.prerelease.find((segment): segment is string => typeof segment === "string") ?? "dev";
	const numericSegment = [...parsed.prerelease]
		.reverse()
		.find((segment): segment is number => typeof segment === "number");
	const prereleaseBase =
		WINDOWS_MSI_PRERELEASE_BASES[prereleaseLabel as keyof typeof WINDOWS_MSI_PRERELEASE_BASES];

	if (!prereleaseBase && prereleaseBase !== 0) {
		throw new Error(
			`Desktop app version ${appVersion} uses unsupported prerelease label "${prereleaseLabel}" for Windows MSI (supported: dev, alpha, beta, rc)`,
		);
	}

	if (numericSegment === undefined || numericSegment > WINDOWS_MSI_PRERELEASE_LIMIT) {
		throw new Error(
			`Desktop app version ${appVersion} needs a numeric prerelease segment <= ${WINDOWS_MSI_PRERELEASE_LIMIT} for Windows MSI`,
		);
	}

	return `${parsed.major}.${parsed.minor}.${patchWindow + prereleaseBase + numericSegment}`;
}

export function validateDesktopBundleConfig(config: DesktopBundleConfig): {
	appVersion: string;
	expectedWixVersion: string;
	actualWixVersion: string | null;
} {
	const appVersion = config.version;
	const expectedWixVersion = deriveWindowsWixVersion(appVersion);
	const actualWixVersion = config.bundle.windows.wix.version;

	if (!windowsWixVersionsMatch(actualWixVersion, expectedWixVersion)) {
		throw new Error(
			`Desktop Windows MSI version mismatch: tauri.conf version ${appVersion} requires bundle.windows.wix.version ${expectedWixVersion} (or ${expectedWixVersion}.0), found ${actualWixVersion}`,
		);
	}

	return {
		appVersion,
		expectedWixVersion,
		actualWixVersion,
	};
}

export function synchronizeDesktopBundleConfig(
	config: DesktopBundleConfig,
	inputVersion: string,
): DesktopBundleConfig {
	const appVersion = parseDesktopReleaseVersion(inputVersion);
	const wixVersion = deriveWindowsWixVersion(appVersion);
	const currentWixVersion = config.bundle.windows.wix.version;
	const wixVersionMatches = windowsWixVersionsMatch(currentWixVersion, wixVersion);

	if (config.version === appVersion && wixVersionMatches) {
		return config;
	}
	return {
		...config,
		version: appVersion,
		bundle: {
			...config.bundle,
			windows: {
				...config.bundle.windows,
				wix: {
					...config.bundle.windows.wix,
					version: wixVersionMatches ? currentWixVersion : wixVersion,
				},
			},
		},
	};
}

export async function loadDesktopBundleConfig(configPath: string): Promise<DesktopBundleConfig> {
	const raw = await readFile(configPath, "utf8");
	return DesktopBundleConfigSchema.parse(JSON.parse(raw));
}
