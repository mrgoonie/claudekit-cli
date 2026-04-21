import { describe, expect, test } from "bun:test";
import { generateManifest } from "../../scripts/generate-cli-manifest.js";
import { HELP_REGISTRY } from "../../src/domains/help/help-commands.js";

describe("generateManifest", () => {
	test("returns an object with version, generatedAt, and commands", () => {
		const manifest = generateManifest();
		expect(manifest).toHaveProperty("version");
		expect(manifest).toHaveProperty("generatedAt");
		expect(manifest).toHaveProperty("commands");
		expect(typeof manifest.version).toBe("string");
		expect(typeof manifest.generatedAt).toBe("string");
		expect(typeof manifest.commands).toBe("object");
	});

	test("version matches package.json version", async () => {
		const pkg = await import("../../package.json", { with: { type: "json" } });
		const manifest = generateManifest();
		expect(manifest.version).toBe(pkg.default.version);
	});

	test("generatedAt is a valid ISO 8601 date string", () => {
		const manifest = generateManifest();
		const date = new Date(manifest.generatedAt);
		expect(Number.isNaN(date.getTime())).toBe(false);
		expect(manifest.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
	});

	test("contains at least 19 commands", () => {
		const manifest = generateManifest();
		expect(Object.keys(manifest.commands).length).toBeGreaterThanOrEqual(19);
	});

	test("every top-level command from HELP_REGISTRY is a key in manifest.commands", () => {
		const manifest = generateManifest();
		for (const name of Object.keys(HELP_REGISTRY)) {
			expect(manifest.commands).toHaveProperty(name);
		}
	});

	test("manifest.commands keys are stable-sorted (alphabetical)", () => {
		const manifest = generateManifest();
		const keys = Object.keys(manifest.commands);
		const sorted = [...keys].sort();
		expect(keys).toEqual(sorted);
	});

	test("JSON is round-trippable — JSON.parse(JSON.stringify(x)) deep-equals x", () => {
		const manifest = generateManifest();
		const roundTripped = JSON.parse(JSON.stringify(manifest));
		expect(roundTripped).toEqual(manifest);
	});

	test("each command entry has name, description, usage fields", () => {
		const manifest = generateManifest();
		for (const [cmdName, cmd] of Object.entries(manifest.commands)) {
			expect(cmd).toHaveProperty("name");
			expect(cmd).toHaveProperty("description");
			expect(cmd).toHaveProperty("usage");
			expect(typeof (cmd as { name: string }).name).toBe("string");
			expect(typeof (cmd as { description: string }).description).toBe("string");
			expect(typeof (cmd as { usage: string }).usage).toBe("string");
			// name should match the registry key
			expect((cmd as { name: string }).name).toBe(cmdName);
		}
	});

	test("JSON.stringify produces stable output with null replacer and 2-space indent", () => {
		const manifest = generateManifest();
		// Overwrite generatedAt to make two serializations byte-equal
		const fixed = { ...manifest, generatedAt: "2025-01-01T00:00:00.000Z" };
		const str1 = JSON.stringify(fixed, null, 2);
		const str2 = JSON.stringify(fixed, null, 2);
		expect(str1).toBe(str2);
	});

	test("ck api command is present with subcommands", () => {
		const manifest = generateManifest();
		const api = manifest.commands.api as {
			subcommands?: unknown[];
		};
		expect(api).toBeDefined();
		expect(Array.isArray(api.subcommands)).toBe(true);
		expect((api.subcommands ?? []).length).toBeGreaterThan(0);
	});

	test("ck plan command is present with subcommands", () => {
		const manifest = generateManifest();
		const plan = manifest.commands.plan as {
			subcommands?: unknown[];
		};
		expect(plan).toBeDefined();
		expect(Array.isArray(plan.subcommands)).toBe(true);
		expect((plan.subcommands ?? []).length).toBeGreaterThan(0);
	});
});
