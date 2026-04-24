/**
 * Codex hook wrapper generator.
 *
 * Generates a small .cjs wrapper script for each installed hook. The wrapper:
 *   1. Spawns the original .cjs hook
 *   2. Reads its JSON stdout
 *   3. Strips fields the Codex version does not support (keyed by hook event)
 *   4. Re-emits sanitized JSON to stdout
 *
 * The wrapper script path is what gets written into hooks.json `command` fields.
 * Original hook scripts stay untouched under ~/.claude/hooks/.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { CodexCapabilities } from "./codex-capabilities.js";
import { isPathWithinBoundary } from "./codex-path-safety.js";

/** Result of generating a wrapper for one hook file */
export interface WrapperGenerateResult {
	wrapperPath: string;
	originalPath: string;
	success: boolean;
	error?: string;
}

/**
 * Derive a wrapper filename that is unique per source absolute path.
 *
 * Uses a short hash (first 8 hex chars of SHA-256 over the absolute source path)
 * prefixed to the basename so two hooks in different directories with the same
 * filename (e.g. a/session-init.cjs, b/session-init.cjs) get distinct wrapper
 * filenames instead of silently overwriting each other.
 */
function wrapperFilename(originalPath: string): string {
	const abs = resolve(originalPath);
	const hash = createHash("sha256").update(abs).digest("hex").slice(0, 8);
	const base = abs.split(/[\\/]/).pop() ?? "hook.cjs";
	return `${hash}-${base}`;
}

/**
 * Generate wrapper .cjs scripts for a set of installed hook files.
 *
 * @param originalPaths   - Absolute paths to the original .cjs hook scripts
 * @param wrapperDir      - Directory where wrapper scripts will be written
 * @param capabilities    - Codex capability record (determines which fields to strip)
 * @param timeoutsByPath  - Optional per-path timeout overrides (ms). Keys are absolute
 *   resolved paths from the hook entry's `timeout` field. Falls back to 30000ms.
 * @returns Array of results, one per hook file
 */
export function generateCodexHookWrappers(
	originalPaths: string[],
	wrapperDir: string,
	capabilities: CodexCapabilities,
	timeoutsByPath?: Record<string, number>,
): WrapperGenerateResult[] {
	const results: WrapperGenerateResult[] = [];

	// Resolve wrapperDir once for path-containment checks below
	const resolvedWrapperDir = resolve(wrapperDir);

	for (const originalPath of originalPaths) {
		const filename = wrapperFilename(originalPath);
		const wrapperPath = join(resolvedWrapperDir, filename);

		// Safety: the generated wrapperPath must not escape wrapperDir.
		// Since wrapperFilename() is a plain "hash-basename.cjs" string with no separators,
		// this check catches any future regression where the filename could contain ".." components.
		if (!isPathWithinBoundary(wrapperPath, resolvedWrapperDir)) {
			results.push({
				wrapperPath,
				originalPath,
				success: false,
				error: `Unsafe wrapper path: ${wrapperPath} escapes wrapper directory ${resolvedWrapperDir}`,
			});
			continue;
		}

		try {
			mkdirSync(dirname(wrapperPath), { recursive: true });
			const resolvedPath = resolve(originalPath);
			const hookTimeoutMs = timeoutsByPath?.[resolvedPath] ?? timeoutsByPath?.[originalPath];
			const content = buildWrapperScript(originalPath, capabilities, hookTimeoutMs);
			writeFileSync(wrapperPath, content, { mode: 0o755 });
			results.push({ wrapperPath, originalPath, success: true });
		} catch (err) {
			results.push({
				wrapperPath,
				originalPath,
				success: false,
				error: err instanceof Error ? err.message : String(err),
			});
		}
	}

	return results;
}

/**
 * Build the wrapper script content for a single hook file.
 *
 * The wrapper is a self-contained CommonJS script (no deps beyond Node.js built-ins)
 * that spawns the original hook, reads its stdout JSON, strips unsupported fields
 * per event, and re-emits to stdout.
 *
 * The stripping rules are baked into the wrapper at generation time so the wrapper
 * does not need to import or reference any ck modules at runtime.
 */
/** Per-event scrubbing rules baked into the generated wrapper script. */
interface EventScrubRules {
	/** Fields to delete unconditionally from the output object */
	deleteFields: string[];
	/** For permissionDecision/decision: allowed set; any other value → field deleted */
	allowedPermissionValues: string[] | null;
}

export function buildWrapperScript(
	originalPath: string,
	capabilities: CodexCapabilities,
	/** Hook timeout in milliseconds. Sourced from the hook entry's `timeout` field. Defaults to 30000ms. */
	hookTimeoutMs?: number,
): string {
	// Build a JSON-serializable scrub-rules object: event → rules
	const scrubRules: Record<string, EventScrubRules> = {};
	for (const [event, caps] of Object.entries(capabilities.events)) {
		const deleteFields: string[] = [];
		if (!caps.supportsAdditionalContext) {
			deleteFields.push("additionalContext");
		}
		const allowedPermissionValues = caps.permissionDecisionValues ?? null;
		if (deleteFields.length > 0 || allowedPermissionValues !== null) {
			scrubRules[event] = { deleteFields, allowedPermissionValues };
		}
	}

	// Escape the original path for embedding in the script
	const escapedOriginalPath = JSON.stringify(originalPath);
	const scrubRulesJson = JSON.stringify(scrubRules);
	// Embed the hook timeout (from hook entry's `timeout` field, or 30s default)
	const effectiveTimeout = hookTimeoutMs ?? 30000;

	return `#!/usr/bin/env node
// AUTO-GENERATED by claudekit ck migrate — DO NOT EDIT
// Codex hook compatibility wrapper for:
//   ${originalPath}
//
// This wrapper spawns the original hook, sanitizes its JSON output
// to remove fields that Codex does not support, then re-emits to stdout.
// To regenerate: run \`ck migrate\` again.

"use strict";

const { spawnSync } = require("node:child_process");

const ORIGINAL_HOOK = ${escapedOriginalPath};
// Scrub rules baked in at generation time (from Codex capability table).
// Shape: { [event]: { deleteFields: string[], allowedPermissionValues: string[] | null } }
const SCRUB_RULES = ${scrubRulesJson};
// Timeout in ms baked in at generation time from hook entry timeout field. Defaults to 30000.
const HOOK_TIMEOUT_MS = ${effectiveTimeout};

// Detect the hook event from the stdin payload (Codex sends JSON with a hook_event_name field).
function getEventFromStdin(stdinData) {
  try {
    const parsed = JSON.parse(stdinData);
    return parsed.hook_event_name || parsed.event || null;
  } catch {
    return null;
  }
}

/**
 * Sanitize the hook's JSON output per the scrub rules for the given event:
 *   1. Delete any fields in deleteFields unconditionally.
 *   2. If allowedPermissionValues is set, delete permissionDecision/decision
 *      fields whose value is not in the allowed set.
 */
function sanitizeOutput(obj, rules) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj;
  const result = Object.assign({}, obj);

  for (const field of rules.deleteFields) {
    delete result[field];
  }

  if (rules.allowedPermissionValues !== null) {
    const allowed = new Set(rules.allowedPermissionValues);
    if (result.permissionDecision !== undefined && !allowed.has(result.permissionDecision)) {
      delete result.permissionDecision;
    }
    if (result.decision !== undefined && !allowed.has(result.decision)) {
      delete result.decision;
    }
  }

  return result;
}

/**
 * True when the given event's scrub rules allow a permissionDecision of "deny".
 * Used to translate Claude Code's exit-code protocol (exit 2 = block) into
 * Codex's JSON protocol ({permissionDecision: "deny"}).
 */
function eventSupportsDeny(rules) {
  if (!rules || rules.allowedPermissionValues === null) return false;
  return rules.allowedPermissionValues.indexOf("deny") !== -1;
}

function emitDeny(reason) {
  process.stdout.write(JSON.stringify({
    permissionDecision: "deny",
    reason: reason && reason.length > 0 ? reason : "Hook blocked this operation",
  }));
  process.exit(0);
}

function main() {
  // Collect stdin
  const stdinChunks = [];
  process.stdin.on("data", (chunk) => stdinChunks.push(chunk));
  process.stdin.on("end", () => {
    const stdinData = Buffer.concat(stdinChunks).toString("utf8");
    const event = getEventFromStdin(stdinData);
    const rules = event && SCRUB_RULES[event];

    // Spawn original hook with same stdin/env
    const result = spawnSync(process.execPath, [ORIGINAL_HOOK], {
      input: stdinData,
      env: process.env,
      encoding: "utf8",
      timeout: HOOK_TIMEOUT_MS,
    });

    if (result.error) {
      // Forward stderr and exit with failure so Codex sees the error
      if (result.stderr) process.stderr.write(result.stderr);
      process.exit(1);
    }

    const stderrText = (result.stderr || "").toString();
    const rawOutput = (result.stdout || "").toString();
    const exitCode = result.status ?? 1;
    // Claude Code protocol: exit 2 + stderr = block. Codex expects JSON instead.
    // Translate only for events where the Codex capability table allows "deny".
    const isBlockSignal = exitCode === 2 && eventSupportsDeny(rules);

    // No stdout: either silent allow (exit 0) or Claude-style block (exit 2).
    if (!rawOutput.trim()) {
      if (isBlockSignal) {
        return emitDeny(stderrText.trim());
      }
      // Non-block failure or plain allow: forward stderr and pass exit code through.
      if (stderrText) process.stderr.write(stderrText);
      process.exit(exitCode);
    }

    // Try to parse stdout as JSON.
    let parsed;
    try {
      parsed = JSON.parse(rawOutput);
    } catch {
      // Non-JSON stdout. If this is a Claude block signal, treat the stdout
      // (or stderr) as the deny reason. Otherwise forward unchanged.
      if (isBlockSignal) {
        const reason = rawOutput.trim() || stderrText.trim();
        return emitDeny(reason);
      }
      if (stderrText) process.stderr.write(stderrText);
      process.stdout.write(rawOutput);
      process.exit(exitCode);
    }

    // Forward stderr for JSON-emitting hooks (diagnostic output). We still
    // scrub and re-emit the JSON to Codex's stdout.
    if (stderrText) process.stderr.write(stderrText);

    // Apply scrub rules for the detected event
    const sanitized = rules ? sanitizeOutput(parsed, rules) : parsed;

    // If the hook signalled block via exit 2 but didn't emit a deny decision
    // in the JSON, translate — otherwise Codex ignores the exit code.
    if (isBlockSignal && (!sanitized || sanitized.permissionDecision !== "deny")) {
      return emitDeny(stderrText.trim());
    }

    process.stdout.write(JSON.stringify(sanitized));
    // When the hook already emitted a valid deny JSON but also exited 2,
    // exit 0 so Codex treats the deny as authoritative (consistent with
    // emitDeny's exit-0 contract).
    process.exit(isBlockSignal ? 0 : exitCode);
  });
}

main();
`;
}
