/**
 * Codex config.toml feature-flag writer.
 *
 * Idempotently merges `[features] codex_hooks = true` into ~/.codex/config.toml
 * using sentinel comments — same pattern as codex-toml-installer.ts uses for
 * the managed agents block.
 *
 * The sentinel block looks like:
 *   # --- ck-managed-features-start ---
 *   [features]
 *   codex_hooks = true
 *   # --- ck-managed-features-end ---
 *
 * Running this function multiple times is safe — the block is replaced in-place
 * on each run, never duplicated.
 */
import { existsSync } from "node:fs";
import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import {
	getCodexGlobalBoundary,
	isCanonicalPathWithinBoundary,
	withCodexTargetLock,
} from "./codex-path-safety.js";

const SENTINEL_START = "# --- ck-managed-features-start ---";
const SENTINEL_END = "# --- ck-managed-features-end ---";

const MANAGED_BLOCK = `${SENTINEL_START}
[features]
codex_hooks = true
${SENTINEL_END}`;

export type FeatureFlagWriteStatus =
	| "written" // Flag was newly added
	| "updated" // Existing managed block was refreshed
	| "already-set" // [features] codex_hooks = true already present outside managed block
	| "failed"; // I/O error

export interface FeatureFlagWriteResult {
	status: FeatureFlagWriteStatus;
	configPath: string;
	error?: string;
}

/**
 * Idempotently ensure `[features] codex_hooks = true` is present in config.toml.
 *
 * Algorithm:
 * 1. Read existing file (or start with empty string if absent).
 * 2. If a managed block already exists, replace it with the canonical block.
 * 3. If `codex_hooks = true` already appears outside a managed block, return early.
 * 4. Otherwise append the managed block at end of file.
 * 5. Atomic write via temp + rename pattern.
 */
export async function ensureCodexHooksFeatureFlag(
	configTomlPath: string,
): Promise<FeatureFlagWriteResult> {
	// Boundary check: prevent writing outside ~/.codex/ or project .codex/ via symlink traversal
	const boundary = resolve(configTomlPath).includes(homedir())
		? getCodexGlobalBoundary()
		: dirname(resolve(configTomlPath));
	if (!(await isCanonicalPathWithinBoundary(dirname(resolve(configTomlPath)), boundary))) {
		return {
			status: "failed",
			configPath: configTomlPath,
			error: `Unsafe path: config.toml target escapes expected Codex boundary (${boundary})`,
		};
	}

	// Serialize all writes to the Codex directory via shared lock
	return withCodexTargetLock(configTomlPath, () => _ensureFeatureFlagLocked(configTomlPath));
}

async function _ensureFeatureFlagLocked(configTomlPath: string): Promise<FeatureFlagWriteResult> {
	let existing = "";

	if (existsSync(configTomlPath)) {
		try {
			existing = await readFile(configTomlPath, "utf8");
		} catch (err) {
			return {
				status: "failed",
				configPath: configTomlPath,
				error: `Failed to read ${configTomlPath}: ${err instanceof Error ? err.message : String(err)}`,
			};
		}
	}

	// Case 1: managed block already present — replace it in-place (idempotent update)
	const hasManagedBlock = existing.includes(SENTINEL_START) && existing.includes(SENTINEL_END);

	if (hasManagedBlock) {
		const replaced = replaceManagedBlock(existing);
		await atomicWrite(configTomlPath, replaced);
		return { status: "updated", configPath: configTomlPath };
	}

	// Case 2: codex_hooks = true already set outside managed block — leave it alone
	if (hasRawFeatureFlag(existing)) {
		return { status: "already-set", configPath: configTomlPath };
	}

	// Case 3: not present — append managed block
	const separator = existing.length > 0 && !existing.endsWith("\n") ? "\n\n" : "\n";
	const updated = `${existing}${separator}${MANAGED_BLOCK}\n`;

	try {
		await atomicWrite(configTomlPath, updated);
	} catch (err) {
		return {
			status: "failed",
			configPath: configTomlPath,
			error: `Failed to write ${configTomlPath}: ${err instanceof Error ? err.message : String(err)}`,
		};
	}

	return { status: "written", configPath: configTomlPath };
}

/**
 * Returns true if `codex_hooks = true` appears in the file content
 * outside of (or regardless of) the managed sentinel block.
 * Used to avoid double-writing when the user set it manually.
 */
function hasRawFeatureFlag(content: string): boolean {
	// Strip any managed block first, then check remaining content.
	// Regex tolerates trailing inline TOML comments (e.g. `codex_hooks = true  # my note`)
	const withoutManaged = removeManagedBlock(content);
	return /^\s*codex_hooks\s*=\s*true(\s*#[^\r\n]*)?\s*$/m.test(withoutManaged);
}

/**
 * Replace the content between sentinels with the canonical managed block.
 * Preserves content before and after the block.
 */
function replaceManagedBlock(content: string): string {
	const startIdx = content.indexOf(SENTINEL_START);
	const endIdx = content.indexOf(SENTINEL_END);

	if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
		// Malformed — just return unchanged
		return content;
	}

	const endOfBlock = endIdx + SENTINEL_END.length;
	// Consume trailing newline if present
	const afterBlock =
		content[endOfBlock] === "\n" ? content.slice(endOfBlock + 1) : content.slice(endOfBlock);

	const before = content.slice(0, startIdx);
	return `${before}${MANAGED_BLOCK}\n${afterBlock}`;
}

/** Strip the managed block from content entirely (used in hasRawFeatureFlag check). */
function removeManagedBlock(content: string): string {
	const startIdx = content.indexOf(SENTINEL_START);
	const endIdx = content.indexOf(SENTINEL_END);

	if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) return content;

	const endOfBlock = endIdx + SENTINEL_END.length;
	const afterBlock =
		content[endOfBlock] === "\n" ? content.slice(endOfBlock + 1) : content.slice(endOfBlock);

	return content.slice(0, startIdx) + afterBlock;
}

/** Write file atomically: write to temp file, then rename (POSIX-atomic). */
async function atomicWrite(filePath: string, content: string): Promise<void> {
	const tempPath = `${filePath}.ck-tmp`;
	try {
		await writeFile(tempPath, content, "utf8");
		// Node's fs.rename is atomic on POSIX
		await rename(tempPath, filePath);
	} catch (err) {
		// Best-effort cleanup of temp file
		try {
			await unlink(tempPath);
		} catch {
			/* ignore cleanup errors */
		}
		throw err;
	}
}
