#!/usr/bin/env bun
/**
 * CAC ↔ HELP_REGISTRY Parity Guard
 *
 * Introspects the registered CAC commands and diffs their options against
 * HELP_REGISTRY entries.  Exits non-zero on drift so CI can call this as a
 * quality gate.
 *
 * Usage:
 *   bun run scripts/check-help-parity.ts
 *
 * Exported API (for tests):
 *   runParityCheck(opts?) → { ok: boolean; report: Mismatch[] }
 */

import { createCliInstance } from "../src/cli/cli-config.js";
import { registerCommands } from "../src/cli/command-registry.js";
import { HELP_REGISTRY } from "../src/domains/help/help-commands.js";

// ---------------------------------------------------------------------------
// Narrow types for the CAC internals we rely on.
// CAC does not export these publicly so we use a local interface.
// If CAC's internal shape changes, the access will fail at runtime with a
// clear error rather than silently passing.
// ---------------------------------------------------------------------------

interface CacOption {
	/** Raw flag string e.g. "-r, --release <version>" */
	rawName: string;
	description: string;
}

interface CacCommand {
	/** Normalised command name (no brackets) */
	name: string;
	/** Raw command name as registered e.g. "plan [action] [target]" */
	rawName: string;
	options: CacOption[];
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** A single per-command drift report */
export interface Mismatch {
	command: string;
	/** Flags registered in CAC but absent from HELP_REGISTRY option groups */
	missingInHelp: string[];
	/** Flags declared in HELP_REGISTRY but not registered in CAC */
	missingInCac: string[];
}

/** Options accepted by runParityCheck (used by tests for synthetic drift) */
export interface ParityCheckOptions {
	/**
	 * Synthetic mismatches to merge into the real result.
	 * Used exclusively by the negative test to verify detection logic.
	 */
	syntheticMismatches?: Mismatch[];
}

// ---------------------------------------------------------------------------
// Flags that are always skipped regardless of command.
// These are CAC's own built-in flags (-h/--help, -V/--version) that are added
// implicitly and never documented per-command.
// ---------------------------------------------------------------------------

const ALWAYS_SKIP_FLAGS = new Set(["--help", "--version", "-h", "-V"]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the leading "--long-flag" token from a rawName string.
 * Examples:
 *   "-r, --release <version>"  → "--release"
 *   "--force"                  → "--force"
 *   "-y, --yes"                → "--yes"
 */
function extractLongFlag(rawName: string): string | null {
	// Strip everything after whitespace (angle bracket args)
	const parts = rawName.split(/\s+/);
	// Pick the longest token that starts with "--"
	for (const part of parts) {
		const clean = part.replace(/[,<>[\]]/g, "").trim();
		if (clean.startsWith("--")) return clean;
	}
	// Fall back to the first "--" prefixed segment
	const match = rawName.match(/(--[\w-]+)/);
	return match ? match[1] : null;
}

/**
 * Determine whether a CAC option should be skipped during parity check.
 * Skips:
 *   1. CAC built-in flags (--help, --version) that are never documented per-command
 *   2. Options registered on the global command (shared across ALL commands)
 *   3. Purely positional args (no "--" prefix)
 *
 * Note: per-command --json, --verbose etc. are NOT skipped — if a command
 * registers them locally they must also appear in the command's help entry.
 */
function isSkippedOption(opt: CacOption, globalLongFlags: Set<string>): boolean {
	const longFlag = extractLongFlag(opt.rawName);
	if (!longFlag) return true; // purely positional / no long flag
	if (ALWAYS_SKIP_FLAGS.has(longFlag)) return true;
	// Skip only if it's declared on the global command (not per-command)
	return globalLongFlags.has(longFlag);
}

/**
 * Collect all long-flag strings from a HELP_REGISTRY command's option groups
 * AND from all subcommand option groups (recursively one level deep).
 *
 * For commands like `ck plan` and `ck api`, action-specific flags live in
 * subcommand entries rather than the top-level optionGroups — but CAC
 * registers them all at the top level. We must union both to avoid false
 * "missing in help" reports.
 *
 * Returns a Set of strings like "--force", "--release", "--port", etc.
 */
function collectHelpRegistryFlags(commandName: string): Set<string> {
	const help = HELP_REGISTRY[commandName];
	if (!help) return new Set();

	const flags = new Set<string>();

	function addFromOptionGroups(groups: typeof help.optionGroups): void {
		for (const group of groups) {
			for (const opt of group.options) {
				// opt.flags may be "-r, --release <version>" — extract the long form
				const longFlag = extractLongFlag(opt.flags);
				if (longFlag) flags.add(longFlag);
			}
		}
	}

	// Top-level option groups
	addFromOptionGroups(help.optionGroups);

	// Subcommand option groups (action-specific flags for multi-action commands)
	for (const sub of help.subcommands ?? []) {
		addFromOptionGroups(sub.optionGroups);
	}

	return flags;
}

/**
 * Collect CAC option rawNames for a given command, excluding global/positional flags.
 * Returns a Map of longFlag → rawName for error messages.
 *
 * @param globalLongFlags - set of long flags registered on the global command;
 *   these are shared CLI-wide and excluded from per-command parity checks.
 */
function collectCacFlags(command: CacCommand, globalLongFlags: Set<string>): Map<string, string> {
	const result = new Map<string, string>();
	for (const opt of command.options) {
		if (isSkippedOption(opt, globalLongFlags)) continue;
		const longFlag = extractLongFlag(opt.rawName);
		if (longFlag) result.set(longFlag, opt.rawName);
	}
	return result;
}

// ---------------------------------------------------------------------------
// Core parity logic
// ---------------------------------------------------------------------------

/**
 * Build and register the full CLI, then diff every top-level command's CAC
 * options against HELP_REGISTRY.
 *
 * Returns { ok: boolean; report: Mismatch[] } — ok is true iff report is empty.
 *
 * @param opts.syntheticMismatches — Additional Mismatch entries injected by tests
 *   to verify that detection logic works (negative test path).
 */
export function runParityCheck(opts: ParityCheckOptions = {}): {
	ok: boolean;
	report: Mismatch[];
} {
	// Build the CLI exactly as production does
	const cli = createCliInstance();
	registerCommands(cli);

	// Access internal commands array (narrow-typed above)
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- CAC internals are not typed
	const rawCli = cli as any;
	const commands = rawCli.commands as CacCommand[];

	if (!Array.isArray(commands)) {
		throw new Error(
			"[parity-guard] CAC internal `commands` array not found. CAC API may have changed.",
		);
	}

	// Build the set of globally-registered long flags (--verbose, --json, --log-file).
	// These are shared CLI-wide and must not be counted against per-command parity.
	const globalOptions: CacOption[] = rawCli.globalCommand?.options ?? [];
	const globalLongFlags = new Set<string>(
		globalOptions.map((o) => extractLongFlag(o.rawName)).filter((f): f is string => f !== null),
	);

	const report: Mismatch[] = [];

	for (const cmd of commands) {
		// Skip the global/"" command which CAC adds implicitly
		if (!cmd.name || cmd.name === "") continue;

		// Only check commands that exist in HELP_REGISTRY
		if (!(cmd.name in HELP_REGISTRY)) continue;

		const cacFlags = collectCacFlags(cmd, globalLongFlags);
		const helpFlags = collectHelpRegistryFlags(cmd.name);

		const missingInHelp: string[] = [];
		const missingInCac: string[] = [];

		// CAC has it → HELP_REGISTRY must declare it
		for (const [longFlag] of cacFlags) {
			if (!helpFlags.has(longFlag)) {
				missingInHelp.push(longFlag);
			}
		}

		// HELP_REGISTRY declares it → CAC must register it
		// Skip global flags — they're shared CLI-wide and needn't appear in CAC per-command
		for (const longFlag of helpFlags) {
			if (globalLongFlags.has(longFlag)) continue;
			if (ALWAYS_SKIP_FLAGS.has(longFlag)) continue;
			if (!cacFlags.has(longFlag)) {
				missingInCac.push(longFlag);
			}
		}

		if (missingInHelp.length > 0 || missingInCac.length > 0) {
			report.push({ command: cmd.name, missingInHelp, missingInCac });
		}
	}

	// Merge synthetic mismatches (test use only)
	if (opts.syntheticMismatches && opts.syntheticMismatches.length > 0) {
		report.push(...opts.syntheticMismatches);
	}

	return { ok: report.length === 0, report };
}

// ---------------------------------------------------------------------------
// CLI entry-point
// ---------------------------------------------------------------------------

function printReport(report: Mismatch[]): void {
	console.error("\n[!] CAC <-> HELP_REGISTRY drift detected:\n");
	for (const m of report) {
		console.error(`  Command: ck ${m.command}`);
		if (m.missingInHelp.length > 0) {
			console.error(`    Missing in HELP_REGISTRY: ${m.missingInHelp.join(", ")}`);
			console.error(`      -> Add these flags to the command's optionGroups in`);
			console.error(`         src/domains/help/commands/${m.command}-command-help.ts`);
		}
		if (m.missingInCac.length > 0) {
			console.error(
				`    Registered in HELP_REGISTRY but absent from CAC: ${m.missingInCac.join(", ")}`,
			);
			console.error("      -> Either add to src/cli/command-registry.ts or remove from help file");
		}
		console.error();
	}
}

if (import.meta.main) {
	try {
		const { ok, report } = runParityCheck();
		if (ok) {
			console.log("[OK] CAC <-> HELP_REGISTRY parity check passed.");
			process.exit(0);
		} else {
			printReport(report);
			process.exit(1);
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`[X] Parity check error: ${message}`);
		process.exit(1);
	}
}
