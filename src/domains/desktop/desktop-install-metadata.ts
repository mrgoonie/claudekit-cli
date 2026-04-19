import { basename, dirname, join } from "node:path";
import { getDesktopInstallMetadataPath } from "@/domains/desktop/desktop-install-path-resolver.js";
import { type DesktopInstallMetadata, DesktopInstallMetadataSchema } from "@/types/desktop.js";
import { ensureDir, pathExists, readJson, remove, writeJson } from "fs-extra";

export function getDesktopDownloadMetadataPath(downloadPath: string): string {
	return join(dirname(downloadPath), `${basename(downloadPath)}.metadata.json`);
}

async function readMetadataAt(
	metadataPath: string,
	options: {
		readJsonFn?: (path: string) => Promise<unknown>;
		pathExistsFn?: (path: string) => Promise<boolean>;
	} = {},
): Promise<DesktopInstallMetadata | null> {
	const pathExistsFn = options.pathExistsFn || pathExists;
	const readJsonFn = options.readJsonFn || readJson;

	if (!(await pathExistsFn(metadataPath))) {
		return null;
	}

	try {
		return DesktopInstallMetadataSchema.parse(await readJsonFn(metadataPath));
	} catch {
		return null;
	}
}

async function writeMetadataAt(
	metadataPath: string,
	metadata: DesktopInstallMetadata,
	options: {
		writeJsonFn?: (path: string, value: unknown, opts: { spaces: number }) => Promise<void>;
		ensureDirFn?: (path: string) => Promise<void>;
	} = {},
): Promise<void> {
	const ensureDirFn = options.ensureDirFn || ensureDir;
	const writeJsonFn = options.writeJsonFn || writeJson;

	await ensureDirFn(dirname(metadataPath));
	await writeJsonFn(metadataPath, metadata, { spaces: 2 });
}

export async function readDesktopInstallMetadata(
	options: {
		platform?: NodeJS.Platform;
		readJsonFn?: (path: string) => Promise<unknown>;
		pathExistsFn?: (path: string) => Promise<boolean>;
	} = {},
): Promise<DesktopInstallMetadata | null> {
	const metadataPath = getDesktopInstallMetadataPath({ platform: options.platform });
	return readMetadataAt(metadataPath, options);
}

export async function readDownloadedDesktopMetadata(
	downloadPath: string,
	options: {
		readJsonFn?: (path: string) => Promise<unknown>;
		pathExistsFn?: (path: string) => Promise<boolean>;
	} = {},
): Promise<DesktopInstallMetadata | null> {
	const metadataPath = getDesktopDownloadMetadataPath(downloadPath);
	return readMetadataAt(metadataPath, options);
}

export async function writeDesktopInstallMetadata(
	metadata: DesktopInstallMetadata,
	options: {
		platform?: NodeJS.Platform;
		writeJsonFn?: (path: string, value: unknown, opts: { spaces: number }) => Promise<void>;
		ensureDirFn?: (path: string) => Promise<void>;
	} = {},
): Promise<void> {
	const metadataPath = getDesktopInstallMetadataPath({ platform: options.platform });
	await writeMetadataAt(metadataPath, metadata, options);
}

export async function writeDownloadedDesktopMetadata(
	downloadPath: string,
	metadata: DesktopInstallMetadata,
	options: {
		writeJsonFn?: (path: string, value: unknown, opts: { spaces: number }) => Promise<void>;
		ensureDirFn?: (path: string) => Promise<void>;
	} = {},
): Promise<void> {
	const metadataPath = getDesktopDownloadMetadataPath(downloadPath);
	await writeMetadataAt(metadataPath, metadata, options);
}

export async function clearDesktopInstallMetadata(
	options: {
		platform?: NodeJS.Platform;
		removeFn?: (path: string) => Promise<void>;
	} = {},
): Promise<void> {
	const metadataPath = getDesktopInstallMetadataPath({ platform: options.platform });
	const removeFn = options.removeFn || remove;
	await removeFn(metadataPath);
}
