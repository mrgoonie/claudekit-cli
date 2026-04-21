import { describe, expect, test } from "bun:test";
import { generateReference } from "../../scripts/generate-cli-reference.js";
import { HELP_REGISTRY } from "../../src/domains/help/help-commands.js";

describe("generateReference", () => {
	test("returns a non-empty markdown string", () => {
		const md = generateReference();
		expect(typeof md).toBe("string");
		expect(md.length).toBeGreaterThan(0);
	});

	test("starts with H1 title '# ClaudeKit CLI Reference'", () => {
		const md = generateReference();
		expect(md.startsWith("# ClaudeKit CLI Reference")).toBe(true);
	});

	test("contains a Table of Contents section", () => {
		const md = generateReference();
		expect(md).toContain("## Table of Contents");
	});

	test("contains H2 section for every top-level command", () => {
		const md = generateReference();
		for (const name of Object.keys(HELP_REGISTRY)) {
			expect(md).toContain(`## ck ${name}`);
		}
	});

	test("contains ## ck api section", () => {
		const md = generateReference();
		expect(md).toContain("## ck api");
	});

	test("contains ## ck plan section", () => {
		const md = generateReference();
		expect(md).toContain("## ck plan");
	});

	test("contains ## ck new section", () => {
		const md = generateReference();
		expect(md).toContain("## ck new");
	});

	test("contains ## ck migrate section", () => {
		const md = generateReference();
		expect(md).toContain("## ck migrate");
	});

	test("contains options table header (| Flag | Description | Default |)", () => {
		const md = generateReference();
		expect(md).toContain("| Flag | Description | Default |");
	});

	test("every OptionDefinition.flags string appears somewhere in the output (pipe-escaped)", () => {
		const md = generateReference();

		// The renderer escapes `|` inside table cells as `\|` to avoid breaking Markdown tables.
		// Normalise both sides before comparing so the test is format-aware.
		const normalise = (s: string) => s.replace(/\\\|/g, "|");
		const normalisedMd = normalise(md);

		for (const cmdHelp of Object.values(HELP_REGISTRY)) {
			for (const group of cmdHelp.optionGroups) {
				for (const opt of group.options) {
					expect(normalisedMd).toContain(opt.flags);
				}
			}
		}
	});

	test("contains H3 subcommand sections for commands with subcommands", () => {
		const md = generateReference();
		// api has subcommands: status, services, setup, proxy, vidcap, reviewweb
		expect(md).toContain("### status");
		// plan has subcommands: parse, validate, status, kanban, create, check, uncheck, add-phase
		expect(md).toContain("### parse");
		expect(md).toContain("### kanban");
	});

	test("ends with a generated timestamp comment", () => {
		const md = generateReference();
		expect(md.trimEnd()).toMatch(/<!--\s*generated:\s*\d{4}-\d{2}-\d{2}T[\d:.Z+-]+\s*-->$/);
	});

	test("TOC contains anchor links to each command section", () => {
		const md = generateReference();
		// TOC should have markdown links
		expect(md).toContain("[ck api]");
		expect(md).toContain("[ck plan]");
	});

	test("each command section contains the description text", () => {
		const md = generateReference();
		for (const cmdHelp of Object.values(HELP_REGISTRY)) {
			// Description should appear in the doc somewhere
			expect(md).toContain(cmdHelp.description);
		}
	});

	test("each command section contains the usage line", () => {
		const md = generateReference();
		for (const cmdHelp of Object.values(HELP_REGISTRY)) {
			expect(md).toContain(cmdHelp.usage);
		}
	});

	test("output is deterministic — two calls with same time produce same structure", () => {
		// Timestamps differ, but structure is identical
		const md1 = generateReference();
		const md2 = generateReference();
		// Remove timestamp lines before comparing structure
		const strip = (s: string) =>
			s.replace(/<!--\s*generated:.*-->/g, "").replace(/\d{4}-\d{2}-\d{2}T[^ >\n]+/g, "TIMESTAMP");
		expect(strip(md1)).toBe(strip(md2));
	});
});
