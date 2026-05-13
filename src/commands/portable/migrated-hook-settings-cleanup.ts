import { existsSync } from "node:fs";
import { readFile, rename, rm, unlink, writeFile } from "node:fs/promises";
import { basename, isAbsolute, relative, resolve } from "node:path";
import { logger } from "../../shared/logger.js";
import {
	isGeneratedContextHookName,
	referencesGeneratedContextHook,
} from "./generated-context-hooks.js";

type HookEntry = { command?: unknown; [key: string]: unknown };
type HookGroup = { hooks?: unknown; [key: string]: unknown };
type HooksSection = Record<string, HookGroup[]>;

export async function pruneSettingsHooks(
	settingsPath: string,
	hooksDir: string,
): Promise<{ hooksPruned: number; filesToRemove: Set<string>; warnings: string[] }> {
	const filesToRemove = new Set<string>();
	const warnings: string[] = [];
	if (!existsSync(settingsPath)) return { hooksPruned: 0, filesToRemove, warnings };

	let parsed: Record<string, unknown>;
	try {
		parsed = JSON.parse(await readFile(settingsPath, "utf8")) as Record<string, unknown>;
	} catch (error) {
		warnings.push(
			`Could not parse ${settingsPath}; hook cleanup skipped (${error instanceof Error ? error.message : String(error)})`,
		);
		return { hooksPruned: 0, filesToRemove, warnings };
	}

	if (!parsed.hooks || typeof parsed.hooks !== "object" || Array.isArray(parsed.hooks)) {
		return { hooksPruned: 0, filesToRemove, warnings };
	}

	const sourceHooks = parsed.hooks as HooksSection;
	const nextHooks: HooksSection = {};
	let hooksPruned = 0;

	for (const [event, groups] of Object.entries(sourceHooks)) {
		if (!Array.isArray(groups)) continue;
		const nextGroups: HookGroup[] = [];
		for (const group of groups) {
			const hooks = Array.isArray(group?.hooks) ? (group.hooks as HookEntry[]) : [];
			const kept = hooks.filter((entry) => {
				const command = typeof entry.command === "string" ? entry.command : "";
				if (!shouldPruneCommand(command, hooksDir)) return true;
				hooksPruned += 1;
				for (const filePath of hookFilesFromCommand(command, hooksDir)) {
					filesToRemove.add(filePath);
				}
				return false;
			});
			if (kept.length > 0) nextGroups.push({ ...group, hooks: kept });
		}
		if (nextGroups.length > 0) nextHooks[event] = nextGroups;
	}

	if (hooksPruned === 0) return { hooksPruned, filesToRemove, warnings };

	if (Object.keys(nextHooks).length > 0) parsed.hooks = nextHooks;
	else {
		parsed = Object.fromEntries(Object.entries(parsed).filter(([key]) => key !== "hooks"));
	}

	if (Object.keys(parsed).length === 0) await rm(settingsPath, { force: true });
	else await atomicWrite(settingsPath, JSON.stringify(parsed, null, 2));

	return { hooksPruned, filesToRemove, warnings };
}

export async function removeHookFiles(paths: Set<string>, hooksDir: string): Promise<number> {
	let removed = 0;
	for (const filePath of paths) {
		if (!isPathWithin(filePath, hooksDir)) continue;
		try {
			if (existsSync(filePath)) {
				await rm(filePath, { force: true, recursive: true });
				removed += 1;
			}
		} catch (error) {
			logger.verbose(`Failed to remove migrated hook file ${filePath}: ${String(error)}`);
		}
	}
	return removed;
}

function shouldPruneCommand(command: string, hooksDir: string): boolean {
	const normalized = command.replace(/\\/g, "/");
	if (!referencesHooksDir(normalized, hooksDir) && !normalized.includes("/.claude/hooks/")) {
		return false;
	}
	return referencesGeneratedContextHook(normalized);
}

function hookFilesFromCommand(command: string, hooksDir: string): string[] {
	const files = new Set<string>();
	for (const ref of command.match(/(?:^|[\s"'(])([^"'\s()]+(?:\.cjs|\.mjs|\.js|\.ts|\.sh))/g) ??
		[]) {
		const cleaned = ref.trim().replace(/^["']|["']$/g, "");
		const name = basename(cleaned);
		if (!name || !isGeneratedContextHookName(name)) continue;
		if (isAbsolute(cleaned) && isPathWithin(cleaned, hooksDir)) files.add(resolve(cleaned));
		else if (referencesHooksDir(cleaned, hooksDir) || cleaned.includes(".claude/hooks/")) {
			files.add(resolve(hooksDir, name));
		}
	}
	return Array.from(files);
}

function referencesHooksDir(command: string, hooksDir: string): boolean {
	const normalizedDir = hooksDir.replace(/\\/g, "/");
	const normalized = command.replace(/\\/g, "/");
	return (
		normalized.includes(normalizedDir) ||
		normalized.includes(".claude/hooks/") ||
		normalized.includes(".codex/hooks/") ||
		normalized.includes(".gemini/hooks/") ||
		normalized.includes(".factory/hooks/")
	);
}

function isPathWithin(filePath: string, parentDir: string): boolean {
	const rel = relative(resolve(parentDir), resolve(filePath));
	return rel === "" || (!!rel && !rel.startsWith("..") && !isAbsolute(rel));
}

async function atomicWrite(filePath: string, content: string): Promise<void> {
	const tempPath = `${filePath}.ck-tmp`;
	try {
		await writeFile(tempPath, `${content}\n`, "utf8");
		await rename(tempPath, filePath);
	} catch (error) {
		await unlink(tempPath).catch(() => undefined);
		throw error;
	}
}
