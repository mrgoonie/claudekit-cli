/**
 * Codex config.toml feature-flag writer.
 *
 * Idempotently ensures `[features] codex_hooks = true` in ~/.codex/config.toml.
 *
 * Two storage strategies depending on what the file already contains:
 *
 * 1. User already has a `[features]` section — merge `codex_hooks = true`
 *    INTO that section (single-line insertion / in-place update). This avoids
 *    TOML duplicate-key errors for users who already configured `[features]`
 *    themselves (e.g. `unified_exec`, `multi_agent`, `shell_snapshot`).
 *
 * 2. No `[features]` section — append a self-contained managed block:
 *      # --- ck-managed-features-start ---
 *      [features]
 *      codex_hooks = true
 *      # --- ck-managed-features-end ---
 *
 * Every run FIRST strips any existing managed block, then decides whether to
 * merge into the user's section or append a new managed block. This self-heals
 * broken configs that already contain duplicate `[features]` headers produced
 * by older versions of this function.
 */
import { existsSync } from "node:fs";
import { readFile, rename, unlink, writeFile } from "node:fs/promises";
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
	| "written" // Flag was newly added to a file that previously had no managed block or user [features]
	| "updated" // Managed block was refreshed, merged into user [features], or duplicate cleaned up
	| "already-set" // codex_hooks = true already present in user [features]; no write needed
	| "failed"; // I/O error

export interface FeatureFlagWriteResult {
	status: FeatureFlagWriteStatus;
	configPath: string;
	error?: string;
}

/**
 * Idempotently ensure `[features] codex_hooks = true` is present in config.toml.
 *
 * @param configTomlPath - Absolute path to the Codex config.toml file.
 * @param isGlobal - When true, boundary is set to ~/.codex/ (global install).
 *   When false (project-scoped), boundary is the config file's parent directory.
 */
export async function ensureCodexHooksFeatureFlag(
	configTomlPath: string,
	isGlobal = false,
): Promise<FeatureFlagWriteResult> {
	const boundary = isGlobal ? getCodexGlobalBoundary() : dirname(resolve(configTomlPath));
	if (!(await isCanonicalPathWithinBoundary(dirname(resolve(configTomlPath)), boundary))) {
		return {
			status: "failed",
			configPath: configTomlPath,
			error: `Unsafe path: config.toml target escapes expected Codex boundary (${boundary})`,
		};
	}

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

	// Step 1: strip ALL managed blocks (cleanup + prepare to re-decide).
	// stripAllManagedBlocks handles the pathological case where a previous bug
	// left multiple managed blocks in the file.
	const { content: stripped, removed: hadManagedBlock } = stripAllManagedBlocks(existing);
	let content = stripped;
	let mutated = hadManagedBlock;

	// Step 2: does a user-owned `[features]` section exist (NOT a sub-table like `[features.foo]`)?
	const featuresHeaderIdx = findFeaturesSectionStart(content);

	if (featuresHeaderIdx !== -1) {
		const { updated, changed } = ensureFlagInFeaturesSection(content, featuresHeaderIdx);
		content = updated;
		mutated = mutated || changed;

		if (!mutated) {
			// User already had `codex_hooks = true` and no managed block existed — no-op.
			return { status: "already-set", configPath: configTomlPath };
		}

		try {
			await atomicWrite(configTomlPath, content);
		} catch (err) {
			return {
				status: "failed",
				configPath: configTomlPath,
				error: `Failed to write ${configTomlPath}: ${err instanceof Error ? err.message : String(err)}`,
			};
		}
		return { status: "updated", configPath: configTomlPath };
	}

	// Step 3: no user `[features]` section — append a managed block.
	const separator = content.length === 0 ? "" : content.endsWith("\n") ? "\n" : "\n\n";
	const withBlock = `${content}${separator}${MANAGED_BLOCK}\n`;

	try {
		await atomicWrite(configTomlPath, withBlock);
	} catch (err) {
		return {
			status: "failed",
			configPath: configTomlPath,
			error: `Failed to write ${configTomlPath}: ${err instanceof Error ? err.message : String(err)}`,
		};
	}

	// If we stripped a managed block then re-appended one, it's semantically an update.
	return { status: hadManagedBlock ? "updated" : "written", configPath: configTomlPath };
}

/**
 * Locate the byte offset of a plain `[features]` header line.
 * Returns -1 if the section doesn't exist, or only sub-tables like `[features.foo]` exist.
 */
function findFeaturesSectionStart(content: string): number {
	const match = /^[ \t]*\[features\][ \t]*(?:#[^\r\n]*)?$/m.exec(content);
	return match ? match.index : -1;
}

/**
 * Within the `[features]` section starting at `headerStartIdx`, ensure a line
 * `codex_hooks = true` exists. The section ends at the next `[table]` header
 * (including sub-tables like `[features.foo]`) or EOF.
 *
 * - If line is missing: insert right after the header.
 * - If line exists with `= false`: update to `= true`.
 * - If line exists with `= true`: no change.
 */
function ensureFlagInFeaturesSection(
	content: string,
	headerStartIdx: number,
): { updated: string; changed: boolean } {
	const headerLineEnd = content.indexOf("\n", headerStartIdx);
	const bodyStart = headerLineEnd === -1 ? content.length : headerLineEnd + 1;

	// Find next TOML table header (`\n[...]`) after the body starts.
	// `+ 1` skips the leading `\n` that the pattern matches, so `bodyEnd` lands
	// exactly on the `[` character of the next header (or EOF). This keeps the
	// preceding newline inside the section body so insertion / slicing is clean.
	const rest = content.slice(bodyStart);
	const nextHeaderMatch = /\n\[[^\]]+\]/.exec(rest);
	const bodyEnd = nextHeaderMatch ? bodyStart + nextHeaderMatch.index + 1 : content.length;

	const body = content.slice(bodyStart, bodyEnd);
	const flagRegex = /^([ \t]*codex_hooks[ \t]*=[ \t]*)(true|false)([ \t]*#[^\r\n]*)?[ \t]*$/m;
	const flagMatch = flagRegex.exec(body);

	if (flagMatch) {
		if (flagMatch[2] === "true") {
			return { updated: content, changed: false };
		}
		const newBody = body.replace(
			flagRegex,
			(_m, prefix, _v, trailing) => `${prefix}true${trailing ?? ""}`,
		);
		return {
			updated: content.slice(0, bodyStart) + newBody + content.slice(bodyEnd),
			changed: true,
		};
	}

	// Insert at the END of the section, preserving the user's existing flag order.
	// This matches user expectations for other managed configs (e.g. `[agents]`)
	// where CK-appended entries go at the bottom rather than jumping to the top.
	if (headerLineEnd === -1) {
		// Header has no trailing content at all — append on a fresh line.
		return { updated: `${content}\ncodex_hooks = true\n`, changed: true };
	}

	// Trim a single trailing blank line inside the body (if any) so the new line
	// sits directly under the last existing flag rather than after a gap.
	let insertAt = bodyEnd;
	while (insertAt > bodyStart && content[insertAt - 1] === "\n" && content[insertAt - 2] === "\n") {
		insertAt -= 1;
	}

	const needsLeadingNewline = insertAt > bodyStart && content[insertAt - 1] !== "\n";
	const insertion = `${needsLeadingNewline ? "\n" : ""}codex_hooks = true\n`;

	return {
		updated: content.slice(0, insertAt) + insertion + content.slice(insertAt),
		changed: true,
	};
}

/**
 * Strip every `# --- ck-managed-features-start --- … # --- ck-managed-features-end ---`
 * block from content. Returns the cleaned content plus whether any block was removed.
 *
 * Handles the pathological case where older buggy versions wrote multiple blocks.
 */
function stripAllManagedBlocks(content: string): { content: string; removed: boolean } {
	let result = content;
	let removed = false;

	while (true) {
		const startIdx = result.indexOf(SENTINEL_START);
		if (startIdx === -1) break;
		const endIdx = result.indexOf(SENTINEL_END, startIdx);
		if (endIdx === -1) break;

		const endOfBlock = endIdx + SENTINEL_END.length;
		// Consume one trailing newline
		const afterBlockStart = result[endOfBlock] === "\n" ? endOfBlock + 1 : endOfBlock;

		// Also consume a preceding blank line separator if present, to avoid leaving
		// stray double-blank runs behind.
		let beforeBlockEnd = startIdx;
		if (beforeBlockEnd >= 1 && result[beforeBlockEnd - 1] === "\n") {
			beforeBlockEnd -= 1;
			if (beforeBlockEnd >= 1 && result[beforeBlockEnd - 1] === "\n") {
				beforeBlockEnd -= 1;
			}
			// Preserve one newline so the content above stays terminated
			beforeBlockEnd += 1;
		}

		result = result.slice(0, beforeBlockEnd) + result.slice(afterBlockStart);
		removed = true;
	}

	return { content: result, removed };
}

/** Write file atomically: write to temp file, then rename (POSIX-atomic). */
async function atomicWrite(filePath: string, content: string): Promise<void> {
	const tempPath = `${filePath}.ck-tmp`;
	try {
		await writeFile(tempPath, content, "utf8");
		await rename(tempPath, filePath);
	} catch (err) {
		try {
			await unlink(tempPath);
		} catch {
			/* ignore cleanup errors */
		}
		throw err;
	}
}
