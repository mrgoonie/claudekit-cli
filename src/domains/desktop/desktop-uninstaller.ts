import { clearDesktopInstallMetadata } from "@/domains/desktop/desktop-install-metadata.js";
import { getDesktopInstallPath } from "@/domains/desktop/desktop-install-path-resolver.js";
import { logger } from "@/shared/logger.js";
import { pathExists, remove } from "fs-extra";

export interface DesktopUninstallResult {
	path: string;
	removed: boolean;
}

export async function uninstallDesktopBinary(
	options: {
		platform?: NodeJS.Platform;
		pathExistsFn?: (path: string) => Promise<boolean>;
		removeFn?: (path: string) => Promise<void>;
		clearInstallMetadataFn?: (options?: { platform?: NodeJS.Platform }) => Promise<void>;
	} = {},
): Promise<DesktopUninstallResult> {
	const targetPath = getDesktopInstallPath({ platform: options.platform });
	const pathExistsFn = options.pathExistsFn || pathExists;
	const removeFn = options.removeFn || remove;
	const clearInstallMetadataFn = options.clearInstallMetadataFn || clearDesktopInstallMetadata;

	if (!(await pathExistsFn(targetPath))) {
		return {
			path: targetPath,
			removed: false,
		};
	}

	await removeFn(targetPath);
	try {
		await clearInstallMetadataFn({ platform: options.platform });
	} catch (error) {
		logger.warning(
			`Desktop uninstall removed the app, but failed to clear install metadata: ${error instanceof Error ? error.message : String(error)}`,
		);
	}

	return {
		path: targetPath,
		removed: true,
	};
}
