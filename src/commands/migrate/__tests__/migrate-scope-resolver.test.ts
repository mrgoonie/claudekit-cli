import { describe, expect, it } from "bun:test";
import { resolveMigrationScope } from "../migrate-scope-resolver.js";

describe("resolveMigrationScope", () => {
	// Helper: all types enabled
	const ALL_TRUE = {
		agents: true,
		commands: true,
		skills: true,
		config: true,
		rules: true,
		hooks: true,
	};

	describe("no flags (default — migrate everything)", () => {
		it("returns all types enabled with empty argv and options", () => {
			expect(resolveMigrationScope([], {})).toEqual(ALL_TRUE);
		});

		it("ignores unrelated argv flags", () => {
			expect(resolveMigrationScope(["--yes", "--all", "--global"], {})).toEqual(ALL_TRUE);
		});
	});

	describe("--config only mode", () => {
		it("enables only config when --config in argv", () => {
			const result = resolveMigrationScope(["--config"], {});
			expect(result).toEqual({
				agents: false,
				commands: false,
				skills: false,
				config: true,
				rules: false,
				hooks: false,
			});
		});

		it("enables only config via options fallback (programmatic)", () => {
			const result = resolveMigrationScope([], { config: true });
			expect(result).toEqual({
				agents: false,
				commands: false,
				skills: false,
				config: true,
				rules: false,
				hooks: false,
			});
		});
	});

	describe("--rules only mode", () => {
		it("enables only rules when --rules in argv", () => {
			const result = resolveMigrationScope(["--rules"], {});
			expect(result).toEqual({
				agents: false,
				commands: false,
				skills: false,
				config: false,
				rules: true,
				hooks: false,
			});
		});

		it("enables only rules via options fallback (programmatic)", () => {
			const result = resolveMigrationScope([], { rules: true });
			expect(result).toEqual({
				agents: false,
				commands: false,
				skills: false,
				config: false,
				rules: true,
				hooks: false,
			});
		});
	});

	describe("--hooks only mode", () => {
		it("enables only hooks when --hooks in argv", () => {
			const result = resolveMigrationScope(["--hooks"], {});
			expect(result).toEqual({
				agents: false,
				commands: false,
				skills: false,
				config: false,
				rules: false,
				hooks: true,
			});
		});

		it("enables only hooks via options fallback (programmatic)", () => {
			const result = resolveMigrationScope([], { hooks: true });
			expect(result).toEqual({
				agents: false,
				commands: false,
				skills: false,
				config: false,
				rules: false,
				hooks: true,
			});
		});
	});

	describe("--config --rules combined", () => {
		it("enables both config and rules when both flags present", () => {
			const result = resolveMigrationScope(["--config", "--rules"], {});
			expect(result).toEqual({
				agents: false,
				commands: false,
				skills: false,
				config: true,
				rules: true,
				hooks: false,
			});
		});

		it("programmatic: config+rules preserves legacy all-types behavior (no argv)", () => {
			const result = resolveMigrationScope([], { config: true, rules: true });
			expect(result).toEqual(ALL_TRUE);
		});

		it("programmatic: config+hooks enables only config and hooks", () => {
			const result = resolveMigrationScope([], { config: true, hooks: true });
			expect(result).toEqual({
				agents: false,
				commands: false,
				skills: false,
				config: true,
				rules: false,
				hooks: true,
			});
		});

		it("programmatic: rules+hooks enables only rules and hooks", () => {
			const result = resolveMigrationScope([], { rules: true, hooks: true });
			expect(result).toEqual({
				agents: false,
				commands: false,
				skills: false,
				config: false,
				rules: true,
				hooks: true,
			});
		});
	});

	describe("--skip-config mode", () => {
		it("disables config when --skip-config in argv", () => {
			const result = resolveMigrationScope(["--skip-config"], {});
			expect(result).toEqual({ ...ALL_TRUE, config: false });
		});

		it("disables config when --no-config in argv", () => {
			const result = resolveMigrationScope(["--no-config"], {});
			expect(result).toEqual({ ...ALL_TRUE, config: false });
		});

		it("disables config via skipConfig option", () => {
			const result = resolveMigrationScope([], { skipConfig: true });
			expect(result).toEqual({ ...ALL_TRUE, config: false });
		});

		it("disables config via config=false option", () => {
			const result = resolveMigrationScope([], { config: false });
			expect(result).toEqual({ ...ALL_TRUE, config: false });
		});
	});

	describe("--skip-rules mode", () => {
		it("disables rules when --skip-rules in argv", () => {
			const result = resolveMigrationScope(["--skip-rules"], {});
			expect(result).toEqual({ ...ALL_TRUE, rules: false });
		});

		it("disables rules when --no-rules in argv", () => {
			const result = resolveMigrationScope(["--no-rules"], {});
			expect(result).toEqual({ ...ALL_TRUE, rules: false });
		});

		it("disables rules via skipRules option", () => {
			const result = resolveMigrationScope([], { skipRules: true });
			expect(result).toEqual({ ...ALL_TRUE, rules: false });
		});
	});

	describe("--skip-hooks mode", () => {
		it("disables hooks when --skip-hooks in argv", () => {
			const result = resolveMigrationScope(["--skip-hooks"], {});
			expect(result).toEqual({ ...ALL_TRUE, hooks: false });
		});

		it("disables hooks when --no-hooks in argv", () => {
			const result = resolveMigrationScope(["--no-hooks"], {});
			expect(result).toEqual({ ...ALL_TRUE, hooks: false });
		});

		it("disables hooks via skipHooks option", () => {
			const result = resolveMigrationScope([], { skipHooks: true });
			expect(result).toEqual({ ...ALL_TRUE, hooks: false });
		});
	});

	describe("combined skip flags", () => {
		it("skips config, rules, and hooks", () => {
			const result = resolveMigrationScope(["--skip-config", "--skip-rules", "--skip-hooks"], {});
			expect(result).toEqual({ ...ALL_TRUE, config: false, rules: false, hooks: false });
		});
	});

	describe("--only-skills mode", () => {
		it("enables only skills when --only-skills in argv", () => {
			const result = resolveMigrationScope(["--only-skills"], {});
			expect(result).toEqual({
				agents: false,
				commands: false,
				skills: true,
				config: false,
				rules: false,
				hooks: false,
			});
		});
	});

	describe("--only-agents mode", () => {
		it("enables only agents when --only-agents in argv", () => {
			const result = resolveMigrationScope(["--only-agents"], {});
			expect(result).toEqual({
				agents: true,
				commands: false,
				skills: false,
				config: false,
				rules: false,
				hooks: false,
			});
		});
	});

	describe("--only-commands mode", () => {
		it("enables only commands when --only-commands in argv", () => {
			const result = resolveMigrationScope(["--only-commands"], {});
			expect(result).toEqual({
				agents: false,
				commands: true,
				skills: false,
				config: false,
				rules: false,
				hooks: false,
			});
		});
	});

	describe("mixed only flags across all types", () => {
		it("enables agents and skills when both flags present", () => {
			const result = resolveMigrationScope(["--only-agents", "--only-skills"], {});
			expect(result).toEqual({
				agents: true,
				commands: false,
				skills: true,
				config: false,
				rules: false,
				hooks: false,
			});
		});

		it("enables agents + config when both flags present", () => {
			const result = resolveMigrationScope(["--only-agents", "--config"], {});
			expect(result).toEqual({
				agents: true,
				commands: false,
				skills: false,
				config: true,
				rules: false,
				hooks: false,
			});
		});
	});

	describe("--skip-skills (primary user motivation)", () => {
		it("disables skills when --skip-skills in argv", () => {
			const result = resolveMigrationScope(["--skip-skills"], {});
			expect(result).toEqual({ ...ALL_TRUE, skills: false });
		});

		it("disables skills when --no-skills in argv", () => {
			const result = resolveMigrationScope(["--no-skills"], {});
			expect(result).toEqual({ ...ALL_TRUE, skills: false });
		});

		it("disables skills via skipSkills option", () => {
			const result = resolveMigrationScope([], { skipSkills: true });
			expect(result).toEqual({ ...ALL_TRUE, skills: false });
		});

		it("disables skills via skills=false option", () => {
			const result = resolveMigrationScope([], { skills: false });
			expect(result).toEqual({ ...ALL_TRUE, skills: false });
		});
	});

	describe("--skip-agents mode", () => {
		it("disables agents when --skip-agents in argv", () => {
			const result = resolveMigrationScope(["--skip-agents"], {});
			expect(result).toEqual({ ...ALL_TRUE, agents: false });
		});

		it("disables agents when --no-agents in argv", () => {
			const result = resolveMigrationScope(["--no-agents"], {});
			expect(result).toEqual({ ...ALL_TRUE, agents: false });
		});

		it("disables agents via skipAgents option", () => {
			const result = resolveMigrationScope([], { skipAgents: true });
			expect(result).toEqual({ ...ALL_TRUE, agents: false });
		});
	});

	describe("--skip-commands mode", () => {
		it("disables commands when --skip-commands in argv", () => {
			const result = resolveMigrationScope(["--skip-commands"], {});
			expect(result).toEqual({ ...ALL_TRUE, commands: false });
		});

		it("disables commands when --no-commands in argv", () => {
			const result = resolveMigrationScope(["--no-commands"], {});
			expect(result).toEqual({ ...ALL_TRUE, commands: false });
		});
	});

	describe("combined skip flags across all types", () => {
		it("skips skills + config (user's symlink + custom CLAUDE.md scenario)", () => {
			const result = resolveMigrationScope(["--skip-skills", "--skip-config"], {});
			expect(result).toEqual({ ...ALL_TRUE, skills: false, config: false });
		});

		it("skips agents + commands + skills, keeps config/rules/hooks", () => {
			const result = resolveMigrationScope(
				["--skip-agents", "--skip-commands", "--skip-skills"],
				{},
			);
			expect(result).toEqual({
				agents: false,
				commands: false,
				skills: false,
				config: true,
				rules: true,
				hooks: true,
			});
		});
	});

	describe("programmatic-only asymmetry (new types are argv-triggered only)", () => {
		// Documents the deliberate asymmetry in the resolver: programmatic
		// `options.{agents,commands,skills} = true` does NOT trigger only-mode
		// (kept simple — only-mode for these types must come from argv flags).
		// Conversely, `options.{...} = false` DOES trigger skip-mode (covered above).
		it("programmatic skills=true does NOT trigger only-mode", () => {
			expect(resolveMigrationScope([], { skills: true })).toEqual(ALL_TRUE);
		});

		it("programmatic agents=true does NOT trigger only-mode", () => {
			expect(resolveMigrationScope([], { agents: true })).toEqual(ALL_TRUE);
		});

		it("programmatic commands=true does NOT trigger only-mode", () => {
			expect(resolveMigrationScope([], { commands: true })).toEqual(ALL_TRUE);
		});
	});

	describe("edge cases", () => {
		it("--config with --skip-config: only mode wins, then skip disables → no config", () => {
			// --config triggers "only" mode → only config
			// --skip-config also present → config is skipped
			const result = resolveMigrationScope(["--config", "--skip-config"], {});
			expect(result.config).toBe(false);
			expect(result.agents).toBe(false);
			expect(result.hooks).toBe(false);
		});

		it("argv flags take precedence over options fallback", () => {
			// --config in argv = only mode, even if options.rules=true
			const result = resolveMigrationScope(["--config"], { rules: true });
			expect(result.config).toBe(true);
			expect(result.rules).toBe(false); // argv --config triggers only-mode
			expect(result.hooks).toBe(false);
		});
	});
});
