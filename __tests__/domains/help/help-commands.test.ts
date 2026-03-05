/**
 * Command help definitions tests
 * Validates HELP_REGISTRY structure and helper functions
 */

import { describe, expect, test } from "bun:test";
import {
	HELP_REGISTRY,
	getAllCommands,
	getCommandHelp,
	hasCommand,
} from "../../../src/domains/help/help-commands.js";

describe("help-commands", () => {
	const expectedCommands = [
		"new",
		"init",
		"config",
		"projects",
		"setup",
		"update",
		"versions",
		"doctor",
		"uninstall",
		"skills",
		"agents",
		"commands",
		"migrate",
	];

	describe("HELP_REGISTRY", () => {
		test("contains all expected top-level commands", () => {
			const commands = Object.keys(HELP_REGISTRY);
			expect(commands).toHaveLength(expectedCommands.length);
			for (const command of expectedCommands) {
				expect(commands).toContain(command);
			}
		});

		test("all commands have required fields", () => {
			for (const command of Object.values(HELP_REGISTRY)) {
				// Required fields
				expect(typeof command.name).toBe("string");
				expect(typeof command.description).toBe("string");
				expect(command.description.length).toBeGreaterThan(0);
				expect(typeof command.usage).toBe("string");
				expect(command.usage).toContain("ck");
				expect(Array.isArray(command.examples)).toBe(true);
				expect(Array.isArray(command.optionGroups)).toBe(true);
				expect(command.optionGroups.length).toBeGreaterThan(0);
			}
		});

		test("all commands have max 3 examples", () => {
			for (const command of Object.values(HELP_REGISTRY)) {
				expect(command.examples.length).toBeLessThanOrEqual(3);
				expect(command.examples.length).toBeGreaterThan(0);
			}
		});

		test("examples have command and description fields", () => {
			for (const command of Object.values(HELP_REGISTRY)) {
				for (const example of command.examples) {
					expect(typeof example.command).toBe("string");
					expect(example.command.length).toBeGreaterThan(0);
					expect(example.command).toContain("ck");
					expect(typeof example.description).toBe("string");
					expect(example.description.length).toBeGreaterThan(0);
				}
			}
		});

		test("option groups have title and options array", () => {
			for (const command of Object.values(HELP_REGISTRY)) {
				for (const group of command.optionGroups) {
					expect(typeof group.title).toBe("string");
					expect(group.title.length).toBeGreaterThan(0);
					expect(Array.isArray(group.options)).toBe(true);
					expect(group.options.length).toBeGreaterThan(0);
				}
			}
		});

		test("options have flags and description", () => {
			for (const command of Object.values(HELP_REGISTRY)) {
				for (const group of command.optionGroups) {
					for (const option of group.options) {
						expect(typeof option.flags).toBe("string");
						expect(option.flags.length).toBeGreaterThan(0);
						expect(typeof option.description).toBe("string");
						expect(option.description.length).toBeGreaterThan(0);
					}
				}
			}
		});
	});

	describe("'new' command", () => {
		test("has correct structure", () => {
			const help = HELP_REGISTRY.new;
			expect(help.name).toBe("new");
			expect(help.description).toContain("Bootstrap");
			expect(help.usage).toBe("ck new [options]");
			expect(help.examples).toHaveLength(2);
			expect(help.optionGroups.length).toBeGreaterThan(0);
		});

		test("has expected option groups", () => {
			const help = HELP_REGISTRY.new;
			const groupTitles = help.optionGroups.map((g) => g.title);
			expect(groupTitles).toContain("Project Options");
			expect(groupTitles).toContain("Filter Options");
			expect(groupTitles).toContain("Installation Options");
		});
	});

	describe("'init' command", () => {
		test("has correct structure", () => {
			const help = HELP_REGISTRY.init;
			expect(help.name).toBe("init");
			expect(help.description).toContain("Initialize");
			expect(help.usage).toBe("ck init [options]");
			expect(help.examples).toHaveLength(2);
		});

		test("has expected option groups", () => {
			const help = HELP_REGISTRY.init;
			const groupTitles = help.optionGroups.map((g) => g.title);
			expect(groupTitles).toContain("Project Options");
			expect(groupTitles).toContain("Filter Options");
			expect(groupTitles).toContain("Installation Options");
		});
	});

	describe("'update' command", () => {
		test("has correct structure", () => {
			const help = HELP_REGISTRY.update;
			expect(help.name).toBe("update");
			expect(help.description).toContain("Update ClaudeKit CLI");
			expect(help.usage).toBe("ck update [options]");
			expect(help.examples).toHaveLength(2);
		});

		test("has deprecated options with deprecation info", () => {
			const help = HELP_REGISTRY.update;
			const deprecatedGroup = help.optionGroups.find((g) => g.title === "Deprecated Options");
			expect(deprecatedGroup).toBeDefined();
			if (!deprecatedGroup) return;
			expect(deprecatedGroup.options.length).toBeGreaterThan(0);

			// Check deprecated options have deprecation info
			for (const option of deprecatedGroup.options) {
				expect(option.deprecated).toBeDefined();
				if (!option.deprecated) continue;
				expect(option.deprecated.message).toBeTruthy();
				expect(option.deprecated.alternative).toBeTruthy();
			}
		});

		test("deprecated --kit option points to ck init", () => {
			const help = HELP_REGISTRY.update;
			const deprecatedGroup = help.optionGroups.find((g) => g.title === "Deprecated Options");
			expect(deprecatedGroup).toBeDefined();
			if (!deprecatedGroup) return;
			const kitOption = deprecatedGroup.options.find((o) => o.flags.includes("--kit"));
			expect(kitOption).toBeDefined();
			if (!kitOption?.deprecated) return;
			expect(kitOption.deprecated.alternative).toBe("ck init --kit <kit>");
		});

		test("deprecated --global option points to ck init", () => {
			const help = HELP_REGISTRY.update;
			const deprecatedGroup = help.optionGroups.find((g) => g.title === "Deprecated Options");
			expect(deprecatedGroup).toBeDefined();
			if (!deprecatedGroup) return;
			const globalOption = deprecatedGroup.options.find((o) => o.flags.includes("--global"));
			expect(globalOption).toBeDefined();
			if (!globalOption?.deprecated) return;
			expect(globalOption.deprecated.alternative).toBe("ck init --global");
		});

		test("has note section about ck update vs ck init", () => {
			const help = HELP_REGISTRY.update;
			expect(help.sections).toBeDefined();
			if (!help.sections) return;
			expect(help.sections.length).toBeGreaterThan(0);
			const noteSection = help.sections.find((s) => s.title === "Note");
			expect(noteSection).toBeDefined();
			if (!noteSection) return;
			expect(noteSection.content).toContain("ck update");
			expect(noteSection.content).toContain("ck init");
		});
	});

	describe("'versions' command", () => {
		test("has correct structure", () => {
			const help = HELP_REGISTRY.versions;
			expect(help.name).toBe("versions");
			expect(help.description).toContain("List available versions");
			expect(help.usage).toBe("ck versions [options]");
			expect(help.examples).toHaveLength(2);
		});
	});

	describe("'doctor' command", () => {
		test("has correct structure", () => {
			const help = HELP_REGISTRY.doctor;
			expect(help.name).toBe("doctor");
			expect(help.description).toContain("health check");
			expect(help.usage).toBe("ck doctor [options]");
			expect(help.examples).toHaveLength(3);
		});
	});

	describe("'uninstall' command", () => {
		test("has correct structure", () => {
			const help = HELP_REGISTRY.uninstall;
			expect(help.name).toBe("uninstall");
			expect(help.description).toContain("Remove");
			expect(help.usage).toBe("ck uninstall [options]");
			expect(help.examples).toHaveLength(2);
		});
	});

	describe("'skills' command", () => {
		test("has correct structure", () => {
			const help = HELP_REGISTRY.skills;
			expect(help.name).toBe("skills");
			expect(help.description).toContain("skill");
			expect(help.usage).toBe("ck skills [options]");
			expect(help.examples).toHaveLength(2);
		});

		test("has expected option groups", () => {
			const help = HELP_REGISTRY.skills;
			const groupTitles = help.optionGroups.map((g) => g.title);
			expect(groupTitles).toContain("Mode Options");
			expect(groupTitles).toContain("Installation Options");
			expect(groupTitles).toContain("Uninstall Options");
		});

		test("has sections for supported agents and notes", () => {
			const help = HELP_REGISTRY.skills;
			expect(help.sections).toBeDefined();
			if (!help.sections) return;
			const sectionTitles = help.sections.map((s) => s.title);
			expect(sectionTitles).toContain("Supported Agents");
			expect(sectionTitles).toContain("Notes");
		});
	});

	describe("getCommandHelp()", () => {
		test("returns correct command help", () => {
			const newHelp = getCommandHelp("new");
			expect(newHelp).toBeDefined();
			expect(newHelp?.name).toBe("new");
		});

		test("returns undefined for non-existent command", () => {
			const help = getCommandHelp("nonexistent");
			expect(help).toBeUndefined();
		});

		test("works for all registered commands", () => {
			for (const cmd of expectedCommands) {
				const help = getCommandHelp(cmd);
				expect(help).toBeDefined();
				expect(help?.name).toBe(cmd);
			}
		});
	});

	describe("getAllCommands()", () => {
		test("returns all expected commands", () => {
			const commands = getAllCommands();
			expect(commands).toHaveLength(expectedCommands.length);
		});

		test("returns array of command names", () => {
			const commands = getAllCommands();
			for (const command of expectedCommands) {
				expect(commands).toContain(command);
			}
		});

		test("returns consistent results", () => {
			const commands1 = getAllCommands();
			const commands2 = getAllCommands();
			expect(commands1).toEqual(commands2);
		});
	});

	describe("hasCommand()", () => {
		test("returns true for existing commands", () => {
			for (const command of expectedCommands) {
				expect(hasCommand(command)).toBe(true);
			}
		});

		test("returns false for non-existent commands", () => {
			expect(hasCommand("nonexistent")).toBe(false);
			expect(hasCommand("test")).toBe(false);
			expect(hasCommand("")).toBe(false);
		});

		test("is case-sensitive", () => {
			expect(hasCommand("New")).toBe(false);
			expect(hasCommand("INIT")).toBe(false);
			expect(hasCommand("Update")).toBe(false);
		});
	});

	describe("data quality checks", () => {
		test("no duplicate command names in registry", () => {
			const names = Object.values(HELP_REGISTRY).map((cmd) => cmd.name);
			const uniqueNames = [...new Set(names)];
			expect(names.length).toBe(uniqueNames.length);
		});

		test("all usage strings start with 'ck'", () => {
			for (const command of Object.values(HELP_REGISTRY)) {
				expect(command.usage).toMatch(/^ck\s+/);
			}
		});

		test("all example commands start with 'ck'", () => {
			for (const command of Object.values(HELP_REGISTRY)) {
				for (const example of command.examples) {
					expect(example.command).toMatch(/^ck\s+/);
				}
			}
		});

		test("no empty option groups", () => {
			for (const command of Object.values(HELP_REGISTRY)) {
				for (const group of command.optionGroups) {
					expect(group.options.length).toBeGreaterThan(0);
				}
			}
		});

		test("option entries are valid flags or subcommands", () => {
			for (const command of Object.values(HELP_REGISTRY)) {
				for (const group of command.optionGroups) {
					for (const option of group.options) {
						const isFlag = /--?\w+/.test(option.flags);
						const isSubcommand = /^[a-z][\w-]*/i.test(option.flags);
						expect(isFlag || isSubcommand).toBe(true);
					}
				}
			}
		});
	});
});
