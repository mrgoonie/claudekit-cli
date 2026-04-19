import { clearDesktopInstallMetadata } from "@/domains/desktop/desktop-install-metadata.js";
import { getDesktopInstallPath } from "@/domains/desktop/desktop-install-path-resolver.js";
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
	await clearInstallMetadataFn({ platform: options.platform });

	return {
		path: targetPath,
		removed: true,
	};
}
