import { describe, expect, test } from "bun:test";
import { HELP_REGISTRY, getCommandHelp, hasCommand } from "@/domains/help/help-commands.js";
import { DEFAULT_HELP_OPTIONS, renderGlobalHelp } from "@/domains/help/help-renderer.js";

describe("help registry coverage", () => {
	const expectedCommands = [
		"agents",
		"commands",
		"config",
		"doctor",
		"init",
		"new",
		"port",
		"projects",
		"setup",
		"skills",
		"uninstall",
		"update",
		"versions",
	];

	test("registers all top-level commands surfaced by custom help", () => {
		expect(Object.keys(HELP_REGISTRY).sort()).toEqual(expectedCommands.sort());
	});

	test("can resolve command help entries for discoverability-critical commands", () => {
		for (const command of ["config", "skills", "agents", "commands", "port", "projects"]) {
			expect(hasCommand(command)).toBe(true);
			expect(getCommandHelp(command)).toBeDefined();
		}
	});

	test("global help includes quick-start discoverability hints", () => {
		const output = renderGlobalHelp(HELP_REGISTRY, {
			...DEFAULT_HELP_OPTIONS,
			showBanner: false,
		});

		expect(output).toContain("Quick Start:");
		expect(output).toContain("ck config");
		expect(output).toContain("ck config --help");
		expect(output).toContain("ck skills --help");
		expect(output).toContain("ck port --help");
	});
});
