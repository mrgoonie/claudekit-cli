import { cp, mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, normalize, resolve } from "node:path";
import { pathExists } from "fs-extra";

const LEGACY_KIT_MARKERS = [
	"metadata.json",
	".ck.json",
	"settings.json",
	"settings.local.json",
	"agents",
	"commands",
	"rules",
	"hooks",
	"skills",
	"CLAUDE.md",
];

export type LegacyGlobalKitRepairReason =
	| "not-windows"
	| "custom-global-dir"
	| "no-legacy-dir"
	| "ambiguous-legacy-dirs"
	| "target-exists"
	| "repaired";

export interface LegacyGlobalKitRepairResult {
	status: "repaired" | "skipped";
	reason: LegacyGlobalKitRepairReason;
	legacyDir?: string;
	candidateDirs: string[];
}

interface LegacyGlobalKitRepairOptions {
	targetDir: string;
	env?: NodeJS.ProcessEnv;
	homeDir?: string;
	platform?: NodeJS.Platform;
}

function safeEnvPath(value: string | undefined): string | undefined {
	if (!value || value.trim() === "" || value.includes("..")) {
		return undefined;
	}
	return value;
}

function withoutTrailingSeparators(path: string): string {
	return path.replace(/[\\/]+$/, "");
}

function uniqueExistingOrder(paths: string[]): string[] {
	const seen = new Set<string>();
	const result: string[] = [];

	for (const path of paths) {
		const normalized = normalize(resolve(path));
		if (seen.has(normalized)) continue;
		seen.add(normalized);
		result.push(path);
	}

	return result;
}

export function getLegacyWindowsGlobalKitDirCandidates(
	env: NodeJS.ProcessEnv = process.env,
	homeDir = homedir(),
): string[] {
	const candidates: string[] = [];
	const localAppData = safeEnvPath(env.LOCALAPPDATA);
	const appData = safeEnvPath(env.APPDATA);

	if (localAppData) {
		candidates.push(join(localAppData, ".claude"));
	}

	if (appData) {
		candidates.push(join(appData, ".claude"));
	}

	if (homeDir) {
		candidates.push(`${withoutTrailingSeparators(homeDir)}.claude`);
	}

	return uniqueExistingOrder(candidates);
}

async function isDirectory(path: string): Promise<boolean> {
	try {
		return (await stat(path)).isDirectory();
	} catch {
		return false;
	}
}

async function hasKitMarkers(dir: string): Promise<boolean> {
	if (!(await isDirectory(dir))) return false;

	for (const marker of LEGACY_KIT_MARKERS) {
		if (await pathExists(join(dir, marker))) {
			return true;
		}
	}

	return false;
}

async function isEmptyDirectory(dir: string): Promise<boolean> {
	if (!(await isDirectory(dir))) return false;
	return (await readdir(dir)).length === 0;
}

async function moveDirectory(source: string, target: string): Promise<void> {
	try {
		await rename(source, target);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "EXDEV") {
			throw error;
		}

		await cp(source, target, { recursive: true, errorOnExist: true, force: false });
		await rm(source, { recursive: true, force: true });
	}
}

export async function repairLegacyWindowsGlobalKitDir(
	options: LegacyGlobalKitRepairOptions,
): Promise<LegacyGlobalKitRepairResult> {
	const env = options.env ?? process.env;
	const os = options.platform ?? process.platform;

	if (os !== "win32") {
		return { status: "skipped", reason: "not-windows", candidateDirs: [] };
	}

	if (env.CLAUDE_CONFIG_DIR) {
		return { status: "skipped", reason: "custom-global-dir", candidateDirs: [] };
	}

	const targetDir = normalize(resolve(options.targetDir));
	const candidateDirs = getLegacyWindowsGlobalKitDirCandidates(env, options.homeDir).filter(
		(candidate) => normalize(resolve(candidate)) !== targetDir,
	);
	const legacyDirs: string[] = [];

	for (const candidate of candidateDirs) {
		if (await hasKitMarkers(candidate)) {
			legacyDirs.push(candidate);
		}
	}

	if (legacyDirs.length === 0) {
		return { status: "skipped", reason: "no-legacy-dir", candidateDirs };
	}

	if (legacyDirs.length > 1) {
		return { status: "skipped", reason: "ambiguous-legacy-dirs", candidateDirs };
	}

	const [legacyDir] = legacyDirs;
	const targetExists = await pathExists(targetDir);
	if (targetExists && !(await isEmptyDirectory(targetDir))) {
		return { status: "skipped", reason: "target-exists", legacyDir, candidateDirs };
	}

	if (targetExists) {
		await rm(targetDir, { recursive: true, force: true });
	}

	await mkdir(dirname(targetDir), { recursive: true });
	await moveDirectory(legacyDir, targetDir);

	return { status: "repaired", reason: "repaired", legacyDir, candidateDirs };
}
