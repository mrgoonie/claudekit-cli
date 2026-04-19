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
import { copy, copyFile, ensureDir, pathExists, remove } from "fs-extra";

const execFileAsync = promisify(execFile);

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
		persistInstallMetadataFn?: (
			metadata: NonNullable<Awaited<ReturnType<typeof readDownloadedDesktopMetadata>>>,
		) => Promise<void>;
	} = {},
): Promise<string> {
	const platform = options.platform || process.platform;
	const targetPath = getDesktopInstallPath({ platform });
	const readDownloadedMetadataFn =
		options.readDownloadedMetadataFn || readDownloadedDesktopMetadata;
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
			await remove(backupInstallPath);
		} catch (error) {
			if ((await pathExists(backupInstallPath)) && !(await pathExists(targetPath))) {
				await rename(backupInstallPath, targetPath);
			}
			throw error;
		} finally {
			await remove(stagingDir);
			await remove(stagedInstallPath);
		}
		const metadata = await readDownloadedMetadataFn(downloadPath);
		if (metadata) {
			await persistInstallMetadataFn(metadata);
		}
		return targetPath;
	}

	if (platform === "linux") {
		await copyFile(downloadPath, targetPath);
		await chmod(targetPath, 0o755);
		const metadata = await readDownloadedMetadataFn(downloadPath);
		if (metadata) {
			await persistInstallMetadataFn(metadata);
		}
		return targetPath;
	}

	if (platform === "win32") {
		await copyFile(downloadPath, targetPath);
		const metadata = await readDownloadedMetadataFn(downloadPath);
		if (metadata) {
			await persistInstallMetadataFn(metadata);
		}
		return targetPath;
	}

	throw new Error(`Unsupported install platform: ${platform}`);
}
