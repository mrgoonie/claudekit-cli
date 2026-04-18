/**
 * CLI Arg Contract Tests
 *
 * Extracts all `ck plan` invocations from engineer files and validates
 * that each subcommand and flag exists in the CLI's registered set.
 *
 * Valid subcommands sourced from: plan-command.ts knownActions
 * Valid flags sourced from: PlanCommandOptions interface in plan-command.ts
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// ─── Valid CLI registry (sourced from plan-command.ts) ────────────────────────

/**
 * Known subcommands — from knownActions Set in planCommand() dispatcher.
 * Source: claudekit-cli/src/commands/plan/plan-command.ts
 */
const VALID_SUBCOMMANDS = new Set([
	"parse",
	"validate",
	"status",
	"kanban",
	"create",
	"check",
	"uncheck",
	"add-phase",
]);

/**
 * Valid flags — from PlanCommandOptions interface in plan-command.ts.
 * Source: claudekit-cli/src/commands/plan/plan-command.ts
 */
const VALID_FLAGS = new Set([
	"json",
	"strict",
	"title",
	"phases",
	"dir",
	"priority",
	"issue",
	"after",
	"start",
	"port",
	"open",
	"dev",
	"global",
	// Tracking metadata (CLI-strict plan tracking):
	"source",
	"sessionId",
]);

// ─── Registry freshness check ────────────────────────────────────────────────
// H1: Validate hardcoded sets match CLI source to prevent silent staleness

const CLI_PLAN_COMMAND_SRC = resolve(__dirname, "../../../../src/commands/plan/plan-command.ts");

/** Extract knownActions set values from plan-command.ts source */
function extractKnownActionsFromSource(): Set<string> {
	const src = readFileSync(CLI_PLAN_COMMAND_SRC, "utf8");
	// Match: new Set([\n"parse",\n"validate",...])
	const setMatch = src.match(/knownActions\s*=\s*new\s+Set\(\[\s*([\s\S]*?)\]\)/);
	if (!setMatch) throw new Error("Could not find knownActions in plan-command.ts");
	const items = [...setMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
	return new Set(items);
}

/** Extract PlanCommandOptions keys from plan-command.ts source */
function extractOptionsFromSource(): Set<string> {
	const src = readFileSync(CLI_PLAN_COMMAND_SRC, "utf8");
	// Match the interface block
	const ifMatch = src.match(/interface\s+PlanCommandOptions\s*\{([\s\S]*?)\}/);
	if (!ifMatch) throw new Error("Could not find PlanCommandOptions in plan-command.ts");
	// Filter out comment lines before extracting keys
	const nonCommentLines = ifMatch[1].split("\n").filter((l) => !l.trim().startsWith("//"));
	const keys = [...nonCommentLines.join("\n").matchAll(/(\w+)\??:/g)].map((m) => m[1]);
	return new Set(keys);
}

// ─── Engineer file paths ──────────────────────────────────────────────────────

const ENGINEER_REPO_ROOT = resolve(__dirname, "../../../../../claudekit-engineer");

function resolveEngineerSourceRoot(): string {
	const packageJsonPath = join(ENGINEER_REPO_ROOT, "package.json");
	if (existsSync(packageJsonPath)) {
		try {
			const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
				claudekit?: { sourceDir?: string };
			};
			const sourceDir = packageJson.claudekit?.sourceDir;
			if (sourceDir) {
				const layoutAwareRoot = join(ENGINEER_REPO_ROOT, sourceDir);
				if (existsSync(layoutAwareRoot)) {
					return layoutAwareRoot;
				}
			}
		} catch {
			// Fall back to the legacy layout below.
		}
	}

	return join(ENGINEER_REPO_ROOT, ".claude");
}

const ENGINEER_ROOT = resolveEngineerSourceRoot();
const HAS_ENGINEER_REPO = existsSync(ENGINEER_ROOT);

/** Specific files named in the contract spec */
const NAMED_FILE_CANDIDATES = [
	["hooks/subagent-init.cjs"],
	["hooks/plan-format-kanban.cjs"],
	["skills/cook/references/workflow-steps.md"],
	["skills/ck-plan/references/plan-organization.md", "skills/plan/references/plan-organization.md"],
	["skills/project-management/references/progress-tracking.md"],
];

const NAMED_FILES = NAMED_FILE_CANDIDATES.map((candidates) =>
	candidates
		.map((relativePath) => resolve(ENGINEER_ROOT, relativePath))
		.find((candidatePath) => existsSync(candidatePath)),
).filter((filePath): filePath is string => Boolean(filePath));

// ─── Extraction helpers ───────────────────────────────────────────────────────

interface CkPlanInvocation {
	file: string;
	line: number;
	raw: string;
	subcommand: string | null;
	flags: string[];
}

/**
 * Extract all `ck plan` invocations from a file's content.
 *
 * Only extracts from lines that look like shell invocations:
 * - Lines inside fenced code blocks (```bash, ```sh, ```)
 * - Lines where `ck plan` starts the command (with optional leading whitespace/$)
 *
 * Strips angle-bracket placeholders (<id>, <phase-id>, <name>) before extraction.
 * Skips slash-joined subcommand lists like check/uncheck/add-phase (prose enumerations).
 */
function extractInvocations(filePath: string): CkPlanInvocation[] {
	let content: string;
	try {
		content = readFileSync(filePath, "utf8");
	} catch {
		return [];
	}

	const results: CkPlanInvocation[] = [];
	const lines = content.split("\n");
	let inCodeBlock = false;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const trimmed = line.trim();

		// Track fenced code block state
		if (/^```/.test(trimmed)) {
			inCodeBlock = !inCodeBlock;
			continue;
		}

		// Only process lines with `ck plan` — word boundary prevents substring
		// matches against words ending in "ck" (e.g. "fact-check plan claims").
		if (!/\bck\s+plan\b/.test(line)) continue;

		// Skip /ck:skill references (not CLI invocations)
		if (/\/ck:[a-z]/.test(line)) continue;

		// Skip JS comment lines
		if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;

		// Skip JS test assertion lines
		if (/\.includes\s*\(/.test(line)) continue;

		// Outside code blocks: only accept lines where ck plan is at command start
		// (leading whitespace, $, or nothing before "ck plan")
		if (!inCodeBlock) {
			if (!/^\s*(?:\$\s*)?ck\s+plan/.test(line)) continue;
		}

		// Strip backtick wrappers and angle-bracket placeholders for clean parsing
		const cleaned = line.replace(/`/g, "").replace(/<[^>]+>/g, "PLACEHOLDER");

		// Extract subcommand: word immediately after "ck plan"
		const subMatch = /ck\s+plan\s+(\S+)/.exec(cleaned);
		let subcommand: string | null = null;
		if (subMatch) {
			const candidate = subMatch[1];
			// Skip if it's a flag (starts with --) or a placeholder
			if (!candidate.startsWith("--") && candidate !== "PLACEHOLDER") {
				// Skip slash-joined enumerations like "check/uncheck/add-phase" (prose, not invocation)
				if (!candidate.includes("/")) {
					subcommand = candidate;
				}
			}
		}

		// Extract all --flag occurrences in this line
		const flags: string[] = [];
		const flagRegex = /--([a-z][a-z0-9-]*)/g;
		for (const flagMatch of cleaned.matchAll(flagRegex)) {
			flags.push(flagMatch[1]);
		}

		if (subcommand !== null || flags.length > 0) {
			results.push({
				file: filePath,
				line: i + 1,
				raw: line.trim(),
				subcommand,
				flags,
			});
		}
	}

	return results;
}

/**
 * Collect all `ck plan` invocations from a list of file paths.
 */
function collectFromFiles(filePaths: string[]): CkPlanInvocation[] {
	return filePaths.flatMap(extractInvocations);
}

// ─── Registry freshness tests ────────────────────────────────────────────────

describe("Registry freshness — hardcoded sets match CLI source", () => {
	test("VALID_SUBCOMMANDS matches knownActions in plan-command.ts", () => {
		const sourceActions = extractKnownActionsFromSource();
		expect([...VALID_SUBCOMMANDS].sort()).toEqual([...sourceActions].sort());
	});

	test("VALID_FLAGS matches PlanCommandOptions keys in plan-command.ts", () => {
		const sourceOptions = extractOptionsFromSource();
		expect([...VALID_FLAGS].sort()).toEqual([...sourceOptions].sort());
	});
});

// ─── Named file tests ─────────────────────────────────────────────────────────

describe.skipIf(!HAS_ENGINEER_REPO)("Named engineer files — subcommands are valid", () => {
	const invocations = collectFromFiles(NAMED_FILES);
	const withSubcommands = invocations.filter((inv) => inv.subcommand !== null);

	test("at least one ck plan invocation found in named files", () => {
		expect(invocations.length).toBeGreaterThan(0);
	});

	for (const inv of withSubcommands) {
		const label = `${inv.subcommand} (${inv.file.split("/claudekit-engineer/")[1]}:${inv.line})`;
		test(`subcommand '${label}' is registered in CLI`, () => {
			expect(VALID_SUBCOMMANDS.has(inv.subcommand as string)).toBe(true);
		});
	}
});

describe.skipIf(!HAS_ENGINEER_REPO)("Named engineer files — flags are valid", () => {
	const invocations = collectFromFiles(NAMED_FILES);
	const withFlags = invocations.filter((inv) => inv.flags.length > 0);

	for (const inv of withFlags) {
		for (const flag of inv.flags) {
			const relPath = inv.file.split("/claudekit-engineer/")[1];
			const label = `--${flag} (${relPath}:${inv.line})`;
			test(`flag '${label}' is registered in CLI`, () => {
				expect(VALID_FLAGS.has(flag)).toBe(true);
			});
		}
	}
});

// ─── Recursive file lister ────────────────────────────────────────────────────

/** Recursively collect all file paths under a directory. Returns [] if dir missing. */
function listFilesRecursive(dir: string): string[] {
	if (!existsSync(dir)) return [];
	const results: string[] = [];
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		try {
			if (statSync(full).isDirectory()) {
				results.push(...listFilesRecursive(full));
			} else {
				results.push(full);
			}
		} catch {
			// Skip unreadable entries
		}
	}
	return results;
}

// ─── Catch-all scan ───────────────────────────────────────────────────────────

describe.skipIf(!HAS_ENGINEER_REPO)(
	"Catch-all: all engineer source files — subcommands are valid",
	() => {
		// Recursively collect all files under the current engineer source root.
		const allFiles = listFilesRecursive(ENGINEER_ROOT);

		const invocations = collectFromFiles(allFiles);
		const withSubcommands = invocations.filter((inv) => inv.subcommand !== null);

		test("catch-all scan finds ck plan invocations", () => {
			expect(invocations.length).toBeGreaterThan(0);
		});

		for (const inv of withSubcommands) {
			const relPath = inv.file.split("/claudekit-engineer/")[1] ?? inv.file;
			const label = `${inv.subcommand} (${relPath}:${inv.line})`;
			test(`subcommand '${label}' is registered in CLI`, () => {
				expect(VALID_SUBCOMMANDS.has(inv.subcommand as string)).toBe(true);
			});
		}
	},
);

describe.skipIf(!HAS_ENGINEER_REPO)(
	"Catch-all: all engineer source files — flags are valid",
	() => {
		const allFiles = listFilesRecursive(ENGINEER_ROOT);

		const invocations = collectFromFiles(allFiles);
		const withFlags = invocations.filter((inv) => inv.flags.length > 0);

		for (const inv of withFlags) {
			for (const flag of inv.flags) {
				const relPath = inv.file.split("/claudekit-engineer/")[1] ?? inv.file;
				const label = `--${flag} (${relPath}:${inv.line})`;
				test(`flag '${label}' is registered in CLI`, () => {
					expect(VALID_FLAGS.has(flag)).toBe(true);
				});
			}
		}
	},
);
