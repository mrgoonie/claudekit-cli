import { execFile } from "node:child_process";
import { chmod, mkdtemp, readdir, rename } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { promisify } from "node:util";
import {
	readDownloadedDesktopMetadata,
	writeDesktopInstallMetadata,
} from "@/domains/desktop/desktop-install-metadata.js";
import {
	getDesktopInstallDirectory,
	getDesktopInstallPath,
} from "@/domains/desktop/desktop-install-path-resolver.js";
import { validateInstalledDesktopArtifact } from "@/domains/desktop/desktop-installed-artifact-validator.js";
import { logger } from "@/shared/logger.js";
import { copy, copyFile, ensureDir, pathExists, remove } from "fs-extra";

const execFileAsync = promisify(execFile);

async function persistInstallMetadataAfterSuccess(
	downloadPath: string,
	targetPath: string,
	platform: NodeJS.Platform,
	readDownloadedMetadataFn: (
		downloadPath: string,
	) => Promise<Awaited<ReturnType<typeof readDownloadedDesktopMetadata>>>,
	validateInstalledArtifactFn: typeof validateInstalledDesktopArtifact,
	persistInstallMetadataFn: (
		metadata: NonNullable<Awaited<ReturnType<typeof readDownloadedDesktopMetadata>>>,
	) => Promise<void>,
): Promise<void> {
	const metadata = await readDownloadedMetadataFn(downloadPath);
	if (!metadata) {
		return;
	}

	const isValid = await validateInstalledArtifactFn(targetPath, metadata, { platform });
	if (!isValid) {
		throw new Error(
			`Installed desktop artifact at ${targetPath} failed validation for release ${metadata.version}`,
		);
	}

	try {
		await persistInstallMetadataFn(metadata);
	} catch (error) {
		logger.warning(
			`Desktop install succeeded, but failed to persist install metadata: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

async function removeBackupInstallPathAfterSuccess(backupInstallPath: string): Promise<void> {
	try {
		await remove(backupInstallPath);
	} catch (error) {
		logger.warning(
			`Desktop install succeeded, but failed to remove backup install at ${backupInstallPath}: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

async function findAppBundle(rootDir: string): Promise<string> {
	const entries = await readdir(rootDir, { withFileTypes: true });
	for (const entry of entries) {
		const fullPath = join(rootDir, entry.name);
		if (entry.isDirectory() && entry.name.endsWith(".app")) {
			return fullPath;
		}
		if (entry.isDirectory()) {
			try {
				return await findAppBundle(fullPath);
			} catch {
				// Keep searching.
			}
		}
	}
	throw new Error("Extracted macOS asset did not contain an .app bundle");
}

export async function installDesktopBinary(
	downloadPath: string,
	options: {
		platform?: NodeJS.Platform;
		extractZipFn?: (source: string, config: { dir: string }) => Promise<void>;
		removeQuarantineFn?: (path: string) => Promise<void>;
		readDownloadedMetadataFn?: (
			downloadPath: string,
		) => Promise<Awaited<ReturnType<typeof readDownloadedDesktopMetadata>>>;
		validateInstalledArtifactFn?: typeof validateInstalledDesktopArtifact;
		persistInstallMetadataFn?: (
			metadata: NonNullable<Awaited<ReturnType<typeof readDownloadedDesktopMetadata>>>,
		) => Promise<void>;
	} = {},
): Promise<string> {
	const platform = options.platform || process.platform;
	const targetPath = getDesktopInstallPath({ platform });
	const readDownloadedMetadataFn =
		options.readDownloadedMetadataFn || readDownloadedDesktopMetadata;
	const validateInstalledArtifactFn =
		options.validateInstalledArtifactFn || validateInstalledDesktopArtifact;
	const persistInstallMetadataFn =
		options.persistInstallMetadataFn ||
		((metadata: NonNullable<Awaited<ReturnType<typeof readDownloadedDesktopMetadata>>>) =>
			writeDesktopInstallMetadata(metadata, { platform }));
	await ensureDir(getDesktopInstallDirectory({ platform }));

	if (platform === "darwin") {
		const extractZipFn =
			options.extractZipFn ||
			(async (source: string, config: { dir: string }) => {
				const { default: extractZip } = await import("extract-zip");
				await extractZip(source, config);
			});
		const removeQuarantineFn =
			options.removeQuarantineFn ||
			(async (path: string) => {
				await execFileAsync("xattr", ["-dr", "com.apple.quarantine", path]);
			});
		const stagingDir = await mkdtemp(join(tmpdir(), "ck-desktop-app-"));
		const stagedInstallPath = join(dirname(targetPath), `${basename(targetPath)}.new`);
		const backupInstallPath = join(dirname(targetPath), `${basename(targetPath)}.backup`);
		let swappedInstall = false;
		try {
			await extractZipFn(downloadPath, { dir: stagingDir });
			const appBundlePath = await findAppBundle(stagingDir);
			await remove(stagedInstallPath);
			await remove(backupInstallPath);
			await copy(appBundlePath, stagedInstallPath);
			await removeQuarantineFn(stagedInstallPath);
			if (await pathExists(targetPath)) {
				await rename(targetPath, backupInstallPath);
			}
			await rename(stagedInstallPath, targetPath);
			swappedInstall = true;
			await persistInstallMetadataAfterSuccess(
				downloadPath,
				targetPath,
				platform,
				readDownloadedMetadataFn,
				validateInstalledArtifactFn,
				persistInstallMetadataFn,
			);
			await removeBackupInstallPathAfterSuccess(backupInstallPath);
		} catch (error) {
			if (await pathExists(backupInstallPath)) {
				if (await pathExists(targetPath)) {
					await remove(targetPath);
				}
				await rename(backupInstallPath, targetPath);
			} else if (swappedInstall && (await pathExists(targetPath))) {
				await remove(targetPath);
			}
			throw error;
		} finally {
			await remove(stagingDir);
			await remove(stagedInstallPath);
		}
		return targetPath;
	}

	if (platform === "linux") {
		const backupInstallPath = join(dirname(targetPath), `${basename(targetPath)}.backup`);
		try {
			await remove(backupInstallPath);
			if (await pathExists(targetPath)) {
				await rename(targetPath, backupInstallPath);
			}
			await copyFile(downloadPath, targetPath);
			await chmod(targetPath, 0o755);
			await persistInstallMetadataAfterSuccess(
				downloadPath,
				targetPath,
				platform,
				readDownloadedMetadataFn,
				validateInstalledArtifactFn,
				persistInstallMetadataFn,
			);
			await removeBackupInstallPathAfterSuccess(backupInstallPath);
		} catch (error) {
			if (await pathExists(backupInstallPath)) {
				if (await pathExists(targetPath)) {
					await remove(targetPath);
				}
				await rename(backupInstallPath, targetPath);
			} else if (await pathExists(targetPath)) {
				await remove(targetPath);
			}
			throw error;
		}
		return targetPath;
	}

	if (platform === "win32") {
		const backupInstallPath = join(dirname(targetPath), `${basename(targetPath)}.backup`);
		try {
			await remove(backupInstallPath);
			if (await pathExists(targetPath)) {
				await rename(targetPath, backupInstallPath);
			}
			await copyFile(downloadPath, targetPath);
			await persistInstallMetadataAfterSuccess(
				downloadPath,
				targetPath,
				platform,
				readDownloadedMetadataFn,
				validateInstalledArtifactFn,
				persistInstallMetadataFn,
			);
			await removeBackupInstallPathAfterSuccess(backupInstallPath);
		} catch (error) {
			if (await pathExists(backupInstallPath)) {
				if (await pathExists(targetPath)) {
					await remove(targetPath);
				}
				await rename(backupInstallPath, targetPath);
			} else if (await pathExists(targetPath)) {
				await remove(targetPath);
			}
			throw error;
		}
		return targetPath;
	}

	throw new Error(`Unsupported install platform: ${platform}`);
}
