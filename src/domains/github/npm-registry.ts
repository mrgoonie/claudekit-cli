/**
 * NPM Registry Client
 * Interface with npm registry API to fetch package metadata
 */

import { logger } from "@/shared/logger.js";

// Default npm registry URL
const DEFAULT_REGISTRY_URL = "https://registry.npmjs.org";

// Request timeout in milliseconds
const REQUEST_TIMEOUT = 5000;

/**
 * NPM package info from registry
 */
export interface NpmPackageInfo {
	name: string;
	version: string; // latest version
	description?: string;
	"dist-tags": {
		latest: string;
		beta?: string;
		next?: string;
		dev?: string;
		[key: string]: string | undefined;
	};
	versions: Record<string, NpmVersionInfo>;
	time: Record<string, string>;
}

/**
 * NPM version info
 */
export interface NpmVersionInfo {
	name: string;
	version: string;
	description?: string;
	deprecated?: string;
	dist?: {
		tarball: string;
		shasum: string;
		integrity?: string;
	};
}

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(
	url: string,
	options: RequestInit = {},
	timeout: number = REQUEST_TIMEOUT,
): Promise<Response> {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeout);

	try {
		const response = await fetch(url, {
			...options,
			signal: controller.signal,
		});
		return response;
	} finally {
		clearTimeout(timeoutId);
	}
}

/**
 * NPM Registry Client
 * Provides methods to fetch package information from npm registry
 */
export class NpmRegistryClient {
	/**
	 * Fetch package info from npm registry
	 * @param packageName - Name of the npm package
	 * @param registryUrl - Optional custom registry URL
	 * @returns Package information or null on failure
	 */
	static async getPackageInfo(
		packageName: string,
		registryUrl?: string,
	): Promise<NpmPackageInfo | null> {
		// Validate package name
		if (!packageName || typeof packageName !== "string" || packageName.trim() === "") {
			throw new Error("Invalid package name: must be a non-empty string");
		}

		const registry = registryUrl || DEFAULT_REGISTRY_URL;
		const url = `${registry}/${encodeURIComponent(packageName)}`;

		logger.debug(`Fetching package info from: ${url}`);

		try {
			const response = await fetchWithTimeout(url, {
				headers: {
					Accept: "application/json",
				},
			});

			if (!response.ok) {
				if (response.status === 404) {
					logger.debug(`Package not found: ${packageName}`);
					return null;
				}
				throw new Error(`Registry returned ${response.status}: ${response.statusText}`);
			}

			const data = (await response.json()) as NpmPackageInfo;
			logger.debug(`Package info fetched: ${packageName}@${data["dist-tags"]?.latest}`);
			return data;
		} catch (error) {
			if (error instanceof Error && error.name === "AbortError") {
				logger.debug(`Request timeout for ${packageName}`);
				throw new Error(`Request timeout fetching ${packageName} from npm registry`);
			}
			throw error;
		}
	}

	/**
	 * Get latest version of a package
	 * @param packageName - Name of the npm package
	 * @param registryUrl - Optional custom registry URL
	 * @returns Latest version string or null on failure
	 */
	static async getLatestVersion(packageName: string, registryUrl?: string): Promise<string | null> {
		try {
			const info = await NpmRegistryClient.getPackageInfo(packageName, registryUrl);
			if (!info) return null;

			const latestVersion = info["dist-tags"]?.latest;
			if (!latestVersion) {
				logger.debug(`No latest version found for ${packageName}`);
				return null;
			}

			return latestVersion;
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			logger.debug(`Failed to get latest version for ${packageName}: ${message}`);
			return null;
		}
	}

	/**
	 * Get beta version of a package (if available)
	 * @param packageName - Name of the npm package
	 * @param registryUrl - Optional custom registry URL
	 * @returns Beta version string or null if not available
	 * @deprecated Use getDevVersion() instead
	 */
	static async getBetaVersion(packageName: string, registryUrl?: string): Promise<string | null> {
		return NpmRegistryClient.getDevVersion(packageName, registryUrl);
	}

	/**
	 * Get dev version of a package (if available)
	 * Checks dev dist-tag first, then falls back to beta/next for compatibility.
	 * @param packageName - Name of the npm package
	 * @param registryUrl - Optional custom registry URL
	 * @returns Dev version string or null if not available
	 */
	static async getDevVersion(packageName: string, registryUrl?: string): Promise<string | null> {
		try {
			const info = await NpmRegistryClient.getPackageInfo(packageName, registryUrl);
			if (!info) return null;

			// Check dev dist-tag first, then fall back to beta/next
			const devVersion =
				info["dist-tags"]?.dev || info["dist-tags"]?.beta || info["dist-tags"]?.next;
			if (!devVersion) {
				logger.debug(`No dev version found for ${packageName}`);
				return null;
			}

			return devVersion;
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			logger.debug(`Failed to get dev version for ${packageName}: ${message}`);
			return null;
		}
	}

	/**
	 * Check if a specific version exists
	 * @param packageName - Name of the npm package
	 * @param version - Version to check
	 * @param registryUrl - Optional custom registry URL
	 * @returns True if version exists
	 */
	static async versionExists(
		packageName: string,
		version: string,
		registryUrl?: string,
	): Promise<boolean> {
		try {
			const info = await NpmRegistryClient.getPackageInfo(packageName, registryUrl);
			if (!info) return false;

			// Check if version exists in versions object
			const exists = version in (info.versions || {});
			logger.debug(`Version ${version} exists for ${packageName}: ${exists}`);
			return exists;
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			logger.debug(`Failed to check version ${version} for ${packageName}: ${message}`);
			return false;
		}
	}

	/**
	 * Get version info for a specific version
	 * @param packageName - Name of the npm package
	 * @param version - Version to get info for
	 * @param registryUrl - Optional custom registry URL
	 * @returns Version info or null if not found
	 */
	static async getVersionInfo(
		packageName: string,
		version: string,
		registryUrl?: string,
	): Promise<NpmVersionInfo | null> {
		try {
			const info = await NpmRegistryClient.getPackageInfo(packageName, registryUrl);
			if (!info) return null;

			const versionInfo = info.versions?.[version];
			if (!versionInfo) {
				logger.debug(`Version ${version} not found for ${packageName}`);
				return null;
			}

			return versionInfo;
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			logger.debug(`Failed to get version info for ${packageName}@${version}: ${message}`);
			return null;
		}
	}

	/**
	 * Get all available versions
	 * @param packageName - Name of the npm package
	 * @param registryUrl - Optional custom registry URL
	 * @returns Array of version strings sorted newest first
	 */
	static async getAllVersions(packageName: string, registryUrl?: string): Promise<string[]> {
		try {
			const info = await NpmRegistryClient.getPackageInfo(packageName, registryUrl);
			if (!info) return [];

			const versions = Object.keys(info.versions || {});

			// Sort by publish time (newest first)
			versions.sort((a, b) => {
				const timeA = info.time?.[a] ? new Date(info.time[a]).getTime() : 0;
				const timeB = info.time?.[b] ? new Date(info.time[b]).getTime() : 0;
				return timeB - timeA;
			});

			return versions;
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			logger.debug(`Failed to get all versions for ${packageName}: ${message}`);
			return [];
		}
	}
}
