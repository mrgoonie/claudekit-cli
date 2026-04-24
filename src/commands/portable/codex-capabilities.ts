/**
 * Codex CLI capability detection — version-keyed feature table for hook compatibility.
 *
 * Probes `codex --version`, looks up a per-version record, and returns the set of hook
 * features that version actually supports. Transform logic uses this to avoid emitting
 * fields / events that Codex will hard-error on.
 *
 * Reference: https://developers.openai.com/codex/hooks (April 2026, v0.124.0-alpha.3)
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import semver from "semver";

const execFileAsync = promisify(execFile);
import { logger } from "../../shared/logger.js";

/** Events Codex understands */
export type CodexHookEvent =
	| "SessionStart"
	| "UserPromptSubmit"
	| "PreToolUse"
	| "PostToolUse"
	| "PermissionRequest"
	| "Stop";

/** Per-event capability flags */
export interface CodexEventCapabilities {
	/** Whether this event is supported at all */
	supported: boolean;
	/** Whether additionalContext output field is accepted */
	supportsAdditionalContext: boolean;
	/** Allowed permissionDecision values (undefined = not applicable) */
	permissionDecisionValues?: string[];
	/** Allowed matcher values (undefined = no matcher filtering) */
	allowedMatchers?: string[];
}

/** Capability record for a Codex version */
export interface CodexCapabilities {
	/** Semver string, e.g. "0.124.0-alpha.3" */
	version: string;
	/** Per-event capability map */
	events: Record<string, CodexEventCapabilities>;
	/** Whether SessionStart supports "startup"|"resume" matchers only (no "clear"/"compact") */
	sessionStartMatchersOnly: string[];
	/** Whether hooks require [features] codex_hooks = true in config.toml */
	requiresFeatureFlag: boolean;
}

/**
 * Capability table keyed by semver string.
 * Add new entries as Codex versions ship new hook capabilities.
 *
 * Strategy: Each entry reflects the MINIMUM capability guaranteed for that version.
 * The lookup uses semver-prefix matching (see detectCodexCapabilities).
 */
export const CODEX_CAPABILITY_TABLE: CodexCapabilities[] = [
	{
		// v0.124.0-alpha.3 — April 2026 baseline (source: issue #730 + spec)
		version: "0.124.0-alpha.3",
		events: {
			SessionStart: {
				supported: true,
				supportsAdditionalContext: true,
				allowedMatchers: ["startup", "resume"],
			},
			UserPromptSubmit: {
				supported: true,
				supportsAdditionalContext: true,
			},
			PreToolUse: {
				supported: true,
				// Hard-errors in v0.124.0-alpha.3 if additionalContext is present
				supportsAdditionalContext: false,
				permissionDecisionValues: ["deny"],
				allowedMatchers: ["Bash"],
			},
			PostToolUse: {
				supported: true,
				supportsAdditionalContext: true,
				allowedMatchers: ["Bash"],
			},
			PermissionRequest: {
				supported: true,
				// Parsed but fails open in spec; hard-errors if additionalContext present
				supportsAdditionalContext: false,
				permissionDecisionValues: ["deny"],
				allowedMatchers: ["Bash"],
			},
			Stop: {
				supported: true,
				supportsAdditionalContext: false,
			},
		},
		sessionStartMatchersOnly: ["startup", "resume"],
		requiresFeatureFlag: true,
	},
];

// ---------------------------------------------------------------------------
// Module-load ordering assertion
// Verify CODEX_CAPABILITY_TABLE is sorted newest-first (ORDERING INVARIANT).
// Throws at import time so a contributor adding an out-of-order entry gets an
// immediate, clear error rather than a silent fallback regression.
// ---------------------------------------------------------------------------
if (CODEX_CAPABILITY_TABLE.length > 1) {
	for (let i = 0; i < CODEX_CAPABILITY_TABLE.length - 1; i++) {
		const newer = semver.coerce(CODEX_CAPABILITY_TABLE[i].version);
		const older = semver.coerce(CODEX_CAPABILITY_TABLE[i + 1].version);
		if (newer && older && !semver.gte(newer, older)) {
			throw new Error(
				`[ck] CODEX_CAPABILITY_TABLE ordering violation: entry[${i}] (${CODEX_CAPABILITY_TABLE[i].version}) must be >= entry[${i + 1}] (${CODEX_CAPABILITY_TABLE[i + 1].version}). Table must be sorted newest-first.`,
			);
		}
	}
}

/**
 * Fallback when version is unknown — uses the OLDEST (most restrictive) entry.
 *
 * ORDERING INVARIANT: CODEX_CAPABILITY_TABLE must be sorted newest-first.
 * The last entry is therefore the oldest and most conservative.
 *
 * Rationale: When version is unknown (Codex not installed, unusual build, etc.)
 * it is safer to strip MORE fields than to risk emitting a field that causes a
 * hard-error in an unsupported Codex version — which was the root cause of #730.
 *
 * Opt-out: set CK_CODEX_COMPAT=optimistic to use the newest entry instead.
 */
const FALLBACK_CAPABILITIES: CodexCapabilities =
	CODEX_CAPABILITY_TABLE[CODEX_CAPABILITY_TABLE.length - 1];

/**
 * Detect Codex CLI capabilities by running `codex --version`.
 *
 * - On success: matches version against CODEX_CAPABILITY_TABLE using semver.
 * - If CK_CODEX_COMPAT=strict: uses the oldest (most restrictive) entry regardless.
 * - If CK_CODEX_COMPAT=optimistic: uses the newest entry as fallback (pre-#730 behavior).
 * - On failure / unknown version: logs a warning and falls back to FALLBACK_CAPABILITIES.
 */
export async function detectCodexCapabilities(): Promise<CodexCapabilities> {
	if (process.env.CK_CODEX_COMPAT === "strict") {
		// Strict mode: use the OLDEST known capability set (most conservative)
		// ORDERING INVARIANT: last entry in table is oldest.
		return CODEX_CAPABILITY_TABLE[CODEX_CAPABILITY_TABLE.length - 1];
	}

	try {
		const { stdout } = await execFileAsync("codex", ["--version"], {
			timeout: 5000,
			encoding: "utf8",
		});
		const raw = stdout.trim();

		// Strip common prefixes like "codex 0.124.0-alpha.3" or "v0.124.0-alpha.3"
		const version = raw.replace(/^(codex\s+)?v?/i, "").trim();
		const match = findCapabilitiesForVersion(version);
		if (match) return match;

		// Version is unknown to our table — warn and fall back
		logger.warning(
			`[!] Codex version ${version} not found in ck capability table; using most-restrictive baseline. Set CK_CODEX_COMPAT=optimistic to use newest known capabilities instead.`,
		);
		return process.env.CK_CODEX_COMPAT === "optimistic"
			? CODEX_CAPABILITY_TABLE[0]
			: FALLBACK_CAPABILITIES;
	} catch {
		// Binary missing, timeout, or non-zero exit — warn and fall back
		logger.warning(
			"[!] Could not detect Codex version; using most-restrictive capability baseline. Set CK_CODEX_COMPAT=optimistic to use newest known capabilities instead.",
		);
		return process.env.CK_CODEX_COMPAT === "optimistic"
			? CODEX_CAPABILITY_TABLE[0]
			: FALLBACK_CAPABILITIES;
	}
}

/**
 * Look up the capability entry for a given version string using semver matching.
 *
 * Strategy: find the newest table entry whose version is satisfied by the detected
 * version (i.e. detected >= entry.version on the same minor series).
 * Table MUST be sorted newest-first (ORDERING INVARIANT).
 */
function findCapabilitiesForVersion(version: string): CodexCapabilities | null {
	// Exact match first — handles pre-release strings like "0.124.0-alpha.3" precisely
	const exact = CODEX_CAPABILITY_TABLE.find((entry) => entry.version === version);
	if (exact) return exact;

	// Semver coerce: some builds report "0.124.0-alpha.3", codex itself may also report
	// shortened "0.124" — coerce both sides to a comparable semver.
	const coercedDetected = semver.coerce(version);
	if (!coercedDetected) return null;

	// Walk table newest-first; return the first entry whose major.minor matches or
	// is older (detected >= entry on major.minor axis).
	for (const entry of CODEX_CAPABILITY_TABLE) {
		const coercedEntry = semver.coerce(entry.version);
		if (!coercedEntry) continue;
		// Same major.minor: this entry's capabilities apply
		if (
			coercedDetected.major === coercedEntry.major &&
			coercedDetected.minor === coercedEntry.minor
		) {
			return entry;
		}
		// Detected version is newer than entry: the entry's baseline still applies
		// (we have no better record, so use the newest entry we do know about)
		if (semver.gte(coercedDetected, coercedEntry)) {
			return entry;
		}
	}

	return null;
}

/**
 * Returns the set of Codex-supported event names.
 * Derived from the NEWEST table entry (index 0, per ordering invariant).
 * This is used for static event filtering — when in doubt, include the event
 * and let the wrapper scrub unsupported fields at runtime.
 */
export const CODEX_SUPPORTED_EVENTS = new Set<string>(
	Object.keys(CODEX_CAPABILITY_TABLE[0].events).filter(
		(e) => CODEX_CAPABILITY_TABLE[0].events[e].supported,
	),
);
