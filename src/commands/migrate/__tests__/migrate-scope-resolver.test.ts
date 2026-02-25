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

		it("programmatic: both true triggers only-mode for those types (no argv)", () => {
			const result = resolveMigrationScope([], { config: true, rules: true });
			expect(result).toEqual({
				agents: false,
				commands: false,
				skills: false,
				config: true,
				rules: true,
				hooks: false,
			});
		});

		it("programmatic: mixed positive toggles include hooks as expected", () => {
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
