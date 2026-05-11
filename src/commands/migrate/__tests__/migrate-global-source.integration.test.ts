/**
 * Integration tests for `ck migrate -g` SOURCE scope behavior.
 *
 * Bug (issue #803): `ck migrate -a codex -g` was reading SOURCE files
 * (agents/commands/skills/CLAUDE.md/rules/hooks) from the CWD `.claude/`
 * directory instead of `~/.claude/`. The `-g` flag only flipped DESTINATION;
 * SOURCE silently inherited CWD.
 *
 * Fix: source-path resolvers now accept an optional `globalOnly` parameter.
 * When true, they bypass CWD discovery and resolve directly to `~/.claude/<type>`.
 *
 * These tests build a sandbox HOME and CWD with fixture `.claude/` trees,
 * then assert each resolver returns the expected path under both modes.
 */
import { afterAll, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import * as os from "node:os";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getAgentSourcePath } from "../../agents/agents-discovery.js";
import { getCommandSourcePath } from "../../commands/commands-discovery.js";
import {
	getConfigSourcePath,
	getHooksSourcePath,
	getRulesSourcePath,
} from "../../portable/config-discovery.js";
import { getSkillSourcePath } from "../../skills/skills-discovery.js";

interface Sandbox {
	root: string;
	home: string;
	cwd: string;
}

function seedClaudeDir(
	base: string,
	types: Array<"agents" | "commands" | "skills" | "hooks" | "rules">,
): void {
	mkdirSync(join(base, ".claude"), { recursive: true });
	for (const type of types) {
		const dir = join(base, ".claude", type);
		mkdirSync(dir, { recursive: true });
		// Seed a marker file so directory exists for findFirstExistingPath
		writeFileSync(join(dir, ".keep"), "");
	}
	// Seed CLAUDE.md (config) at .claude/ root
	writeFileSync(join(base, ".claude", "CLAUDE.md"), "# fixture");
}

function seedSandbox(opts: {
	homeTypes: Array<"agents" | "commands" | "skills" | "hooks" | "rules">;
	cwdTypes: Array<"agents" | "commands" | "skills" | "hooks" | "rules">;
	cwdHasClaudeMd?: boolean;
}): Sandbox {
	// realpathSync resolves macOS /var/folders -> /private/var/folders symlink so
	// that process.cwd() (which returns the resolved path) matches our recorded
	// sandbox paths exactly.
	const root = realpathSync(mkdtempSync(join(tmpdir(), "ck-migrate-global-source-")));
	const home = join(root, "home");
	const cwd = join(root, "project");
	mkdirSync(home, { recursive: true });
	mkdirSync(cwd, { recursive: true });
	if (opts.homeTypes.length > 0) seedClaudeDir(home, opts.homeTypes);
	if (opts.cwdTypes.length > 0) seedClaudeDir(cwd, opts.cwdTypes);
	if (opts.cwdHasClaudeMd === false) {
		// Remove CLAUDE.md if caller wants no project config
		try {
			rmSync(join(cwd, ".claude", "CLAUDE.md"));
		} catch {
			// ignore
		}
	}
	return { root, home, cwd };
}

const ORIGINAL_CWD = process.cwd();
const sandboxes: string[] = [];
// Bun's os.homedir() does not honor $HOME, so we spy on it directly. The spy is
// (re)installed in activate() so each test gets a clean override pointing at its
// own sandbox HOME.
let homedirSpy: ReturnType<typeof spyOn> | null = null;

function activate(sb: Sandbox): void {
	if (homedirSpy) homedirSpy.mockRestore();
	homedirSpy = spyOn(os, "homedir").mockReturnValue(sb.home);
	process.chdir(sb.cwd);
	sandboxes.push(sb.root);
}

afterAll(() => {
	if (homedirSpy) homedirSpy.mockRestore();
	process.chdir(ORIGINAL_CWD);
	for (const root of sandboxes) {
		try {
			rmSync(root, { recursive: true, force: true });
		} catch {
			// best-effort cleanup
		}
	}
});

beforeEach(() => {
	// Restore homedir between tests so a forgotten activate() in a test doesn't
	// silently inherit the previous sandbox.
	if (homedirSpy) {
		homedirSpy.mockRestore();
		homedirSpy = null;
	}
	process.chdir(ORIGINAL_CWD);
});

// ---------------------------------------------------------------------------
// T1: Bug repro — CWD has .claude/, global also has .claude/, run with -g
//     → ALL sources MUST come from global, not CWD.
// ---------------------------------------------------------------------------
describe("ck migrate -g: SOURCE scope (issue #803)", () => {
	it("T1: with globalOnly=true, every resolver returns ~/.claude/<type> even when CWD has .claude/", () => {
		const sb = seedSandbox({
			homeTypes: ["agents", "commands", "skills", "hooks", "rules"],
			cwdTypes: ["agents", "commands", "skills", "hooks", "rules"],
		});
		activate(sb);

		expect(getAgentSourcePath(true)).toBe(join(sb.home, ".claude/agents"));
		expect(getCommandSourcePath(true)).toBe(join(sb.home, ".claude/commands"));
		expect(getSkillSourcePath(true)).toBe(join(sb.home, ".claude/skills"));
		expect(getHooksSourcePath(true)).toBe(join(sb.home, ".claude/hooks"));
		expect(getRulesSourcePath(true)).toBe(join(sb.home, ".claude/rules"));
		expect(getConfigSourcePath(true)).toBe(join(sb.home, ".claude/CLAUDE.md"));
	});

	// -------------------------------------------------------------------------
	// T2: Empty CWD, global has content, run with -g → global sources.
	// -------------------------------------------------------------------------
	it("T2: globalOnly=true with empty CWD still resolves to ~/.claude/", () => {
		const sb = seedSandbox({
			homeTypes: ["agents", "commands", "skills", "hooks", "rules"],
			cwdTypes: [],
		});
		activate(sb);

		expect(getAgentSourcePath(true)).toBe(join(sb.home, ".claude/agents"));
		expect(getCommandSourcePath(true)).toBe(join(sb.home, ".claude/commands"));
		expect(getSkillSourcePath(true)).toBe(join(sb.home, ".claude/skills"));
		expect(getHooksSourcePath(true)).toBe(join(sb.home, ".claude/hooks"));
		expect(getRulesSourcePath(true)).toBe(join(sb.home, ".claude/rules"));
		expect(getConfigSourcePath(true)).toBe(join(sb.home, ".claude/CLAUDE.md"));
	});

	// -------------------------------------------------------------------------
	// T3: Project without -g → CWD-first behavior preserved.
	// -------------------------------------------------------------------------
	it("T3: globalOnly=false with full CWD .claude/ resolves to CWD paths (legacy behavior)", () => {
		const sb = seedSandbox({
			homeTypes: ["agents", "commands", "skills", "hooks", "rules"],
			cwdTypes: ["agents", "commands", "skills", "hooks", "rules"],
		});
		activate(sb);

		expect(getAgentSourcePath(false)).toBe(join(sb.cwd, ".claude/agents"));
		expect(getCommandSourcePath(false)).toBe(join(sb.cwd, ".claude/commands"));
		// Skill resolver has bundled-engineer priority that uses CWD/node_modules.
		// In this sandbox there is no node_modules so it falls through to CWD .claude/skills.
		expect(getSkillSourcePath(false)).toBe(join(sb.cwd, ".claude/skills"));
		expect(getHooksSourcePath(false)).toBe(join(sb.cwd, ".claude/hooks"));
		expect(getRulesSourcePath(false)).toBe(join(sb.cwd, ".claude/rules"));
		expect(getConfigSourcePath(false)).toBe(join(sb.cwd, ".claude/CLAUDE.md"));
	});

	// -------------------------------------------------------------------------
	// T4: No CWD .claude/, run without -g → global fallback (legacy behavior).
	// -------------------------------------------------------------------------
	it("T4: globalOnly=false falls back to global when CWD has no .claude/", () => {
		const sb = seedSandbox({
			homeTypes: ["agents", "commands", "skills", "hooks", "rules"],
			cwdTypes: [],
		});
		activate(sb);

		expect(getAgentSourcePath(false)).toBe(join(sb.home, ".claude/agents"));
		expect(getCommandSourcePath(false)).toBe(join(sb.home, ".claude/commands"));
		expect(getSkillSourcePath(false)).toBe(join(sb.home, ".claude/skills"));
		expect(getHooksSourcePath(false)).toBe(join(sb.home, ".claude/hooks"));
		expect(getRulesSourcePath(false)).toBe(join(sb.home, ".claude/rules"));
		expect(getConfigSourcePath(false)).toBe(join(sb.home, ".claude/CLAUDE.md"));
	});

	// -------------------------------------------------------------------------
	// T5: Partial CWD (only agents/) + -g → CWD agents/ IGNORED.
	// -------------------------------------------------------------------------
	it("T5: globalOnly=true ignores CWD even when only some types exist there", () => {
		const sb = seedSandbox({
			homeTypes: ["agents", "commands", "skills", "hooks", "rules"],
			cwdTypes: ["agents"],
		});
		activate(sb);

		// Without -g this would be CWD .claude/agents (project takes priority).
		// With globalOnly=true the resolver must skip CWD entirely.
		expect(getAgentSourcePath(true)).toBe(join(sb.home, ".claude/agents"));
		expect(getAgentSourcePath(false)).toBe(join(sb.cwd, ".claude/agents"));
	});

	// -------------------------------------------------------------------------
	// T6: globalOnly=true returns null when global path is also missing.
	//     (resolvers that return string | null preserve that contract).
	// -------------------------------------------------------------------------
	it("T6: globalOnly=true returns null when ~/.claude/<type> does not exist", () => {
		const sb = seedSandbox({
			homeTypes: ["agents"], // only agents exists globally
			cwdTypes: ["commands"], // commands exists in CWD but should be ignored
		});
		activate(sb);

		// Agents global exists → returned.
		expect(getAgentSourcePath(true)).toBe(join(sb.home, ".claude/agents"));
		// Commands missing globally → null even though CWD has it.
		expect(getCommandSourcePath(true)).toBeNull();
		// Skills missing globally → null.
		expect(getSkillSourcePath(true)).toBeNull();
	});

	// -------------------------------------------------------------------------
	// T7: Config resolver returns global path string even when global file is missing.
	//     (getConfigSourcePath / getRulesSourcePath / getHooksSourcePath return `string`,
	//     not `string | null`, by their original API contract.)
	// -------------------------------------------------------------------------
	it("T7: string-returning resolvers always return global path under globalOnly=true", () => {
		const sb = seedSandbox({
			homeTypes: [],
			cwdTypes: ["hooks", "rules"],
		});
		activate(sb);

		// Even though global files don't exist, the API returns the expected global path
		// (caller checks existsSync downstream).
		expect(getConfigSourcePath(true)).toBe(join(sb.home, ".claude/CLAUDE.md"));
		expect(getRulesSourcePath(true)).toBe(join(sb.home, ".claude/rules"));
		expect(getHooksSourcePath(true)).toBe(join(sb.home, ".claude/hooks"));
	});

	// -------------------------------------------------------------------------
	// T8: Default param (no arg) preserves legacy behavior.
	// -------------------------------------------------------------------------
	it("T8: calling resolvers with no argument preserves CWD-first legacy behavior", () => {
		const sb = seedSandbox({
			homeTypes: ["agents", "commands", "skills", "hooks", "rules"],
			cwdTypes: ["agents", "commands", "skills", "hooks", "rules"],
		});
		activate(sb);

		// No-argument calls must behave identically to globalOnly=false.
		expect(getAgentSourcePath()).toBe(join(sb.cwd, ".claude/agents"));
		expect(getCommandSourcePath()).toBe(join(sb.cwd, ".claude/commands"));
		expect(getSkillSourcePath()).toBe(join(sb.cwd, ".claude/skills"));
		expect(getHooksSourcePath()).toBe(join(sb.cwd, ".claude/hooks"));
		expect(getRulesSourcePath()).toBe(join(sb.cwd, ".claude/rules"));
		expect(getConfigSourcePath()).toBe(join(sb.cwd, ".claude/CLAUDE.md"));
	});
});

// ---------------------------------------------------------------------------
// T9: Sanity — globalOnly=true never resolves to a CWD-rooted path.
//      Regression guard: if a future refactor reintroduces CWD probing under -g,
//      this fails.
// ---------------------------------------------------------------------------
describe("ck migrate -g: regression guards", () => {
	it("T9: under globalOnly=true, no resolver ever returns a CWD-rooted path", () => {
		const sb = seedSandbox({
			homeTypes: ["agents", "commands", "skills", "hooks", "rules"],
			cwdTypes: ["agents", "commands", "skills", "hooks", "rules"],
		});
		activate(sb);

		const results = [
			getAgentSourcePath(true),
			getCommandSourcePath(true),
			getSkillSourcePath(true),
			getHooksSourcePath(true),
			getRulesSourcePath(true),
			getConfigSourcePath(true),
		];

		for (const path of results) {
			if (path === null) continue;
			expect(path.startsWith(sb.cwd)).toBe(false);
			expect(path.startsWith(sb.home)).toBe(true);
		}
	});
});
