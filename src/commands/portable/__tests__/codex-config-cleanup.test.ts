/**
 * Tests for cleanupStaleCodexConfigEntries
 * Verifies stale config.toml sentinel-block entries are removed when the
 * referenced .toml files no longer exist on disk.
 */
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// We test cleanupStaleCodexConfigEntries by pointing the codex provider at a
// temp directory rather than mocking the filesystem module.  The function
// reads `providers["codex"].agents.projectPath`, so we override that path for
// each test by writing config.toml / agent toml files into the temp dir and
// then temporarily patching the provider config.

import { cleanupStaleCodexConfigEntries } from "../codex-toml-installer.js";
import { providers } from "../provider-registry.js";

const SENTINEL_START = "# --- ck-managed-agents-start ---";
const SENTINEL_END = "# --- ck-managed-agents-end ---";

/** Build a minimal config.toml with a managed block containing given slugs */
function buildConfigToml(slugs: string[]): string {
	if (slugs.length === 0) {
		return `${SENTINEL_START}\n${SENTINEL_END}\n`;
	}
	const entries = slugs
		.map(
			(slug) =>
				`[agents.${slug}]\ndescription = "Test agent ${slug}"\nconfig_file = "agents/${slug}.toml"`,
		)
		.join("\n\n");
	return `${SENTINEL_START}\n${entries}\n${SENTINEL_END}\n`;
}

let tmpDir: string;
let agentsDir: string;
let configTomlPath: string;
let originalProjectPath: string | null;

beforeEach(async () => {
	// Create a fresh temp directory for each test
	tmpDir = await mkdtemp(join(tmpdir(), "ck-codex-cleanup-test-"));
	// Codex agent dir is .codex/agents — mirror that layout inside tmpDir
	agentsDir = join(tmpDir, ".codex", "agents");
	configTomlPath = join(tmpDir, ".codex", "config.toml");
	await mkdir(agentsDir, { recursive: true });

	// Patch the codex provider to use our temp directory
	const codexAgents = providers.codex.agents;
	if (codexAgents) {
		originalProjectPath = codexAgents.projectPath;
		// Point projectPath to our temp dir's .codex/agents
		(codexAgents as { projectPath: string | null }).projectPath = agentsDir;
	}
});

afterEach(async () => {
	// Restore original projectPath
	const codexAgents = providers.codex.agents;
	if (codexAgents) {
		(codexAgents as { projectPath: string | null }).projectPath = originalProjectPath ?? null;
	}
	// Remove temp dir
	await rm(tmpDir, { recursive: true, force: true });
});

describe("cleanupStaleCodexConfigEntries", () => {
	it("returns [] and leaves config.toml unchanged when all managed entries have existing .toml files", async () => {
		const slugs = ["alpha_agent", "beta_agent"];

		// Create agent .toml files
		for (const slug of slugs) {
			await writeFile(join(agentsDir, `${slug}.toml`), `# ${slug}`, "utf-8");
		}

		// Write config.toml with managed block referencing those slugs
		const originalContent = buildConfigToml(slugs);
		await writeFile(configTomlPath, originalContent, "utf-8");

		const removed = await cleanupStaleCodexConfigEntries({
			global: false,
			provider: "codex",
		});

		expect(removed).toEqual([]);
		// File content must be unchanged
		const content = await readFile(configTomlPath, "utf-8");
		expect(content).toBe(originalContent);
	});

	it("returns [slug] and rebuilds managed block when one managed entry is missing its .toml file", async () => {
		const presentSlug = "alpha_agent";
		const staleSlug = "stale_agent";

		// Only create the file for presentSlug
		await writeFile(join(agentsDir, `${presentSlug}.toml`), `# ${presentSlug}`, "utf-8");

		// Write config.toml referencing both slugs
		await writeFile(configTomlPath, buildConfigToml([presentSlug, staleSlug]), "utf-8");

		const removed = await cleanupStaleCodexConfigEntries({
			global: false,
			provider: "codex",
		});

		expect(removed).toEqual([staleSlug]);

		const content = await readFile(configTomlPath, "utf-8");
		// Stale slug must no longer appear in the managed block
		expect(content).not.toContain(`[agents.${staleSlug}]`);
		// Present slug must still be there
		expect(content).toContain(`[agents.${presentSlug}]`);
	});

	it("returns all slugs and produces an empty managed block when all managed entries are missing", async () => {
		const slugs = ["ghost_one", "ghost_two"];

		// Do NOT create any .toml files — all entries are stale
		await writeFile(configTomlPath, buildConfigToml(slugs), "utf-8");

		const removed = await cleanupStaleCodexConfigEntries({
			global: false,
			provider: "codex",
		});

		expect(removed.sort()).toEqual([...slugs].sort());

		// File must still exist and contain no stale entries
		expect(existsSync(configTomlPath)).toBe(true);
		const content = await readFile(configTomlPath, "utf-8");
		for (const slug of slugs) {
			expect(content).not.toContain(`[agents.${slug}]`);
		}
		// Sentinel markers should be stripped when managed block is empty
		expect(content).not.toContain(SENTINEL_START);
		expect(content).not.toContain(SENTINEL_END);
	});

	it("removes legacy (unmanaged) agent entries when .toml files are missing", async () => {
		const slug = "legacy_agent";

		// Write config.toml with a legacy entry OUTSIDE sentinel markers
		const legacyContent = [
			'model = "gpt-5.4"',
			"",
			"[agents]",
			"max_threads = 12",
			"",
			`[agents.${slug}]`,
			`description = "Legacy agent"`,
			`config_file = "agents/${slug}.toml"`,
			"",
			"[features]",
			"unified_exec = true",
		].join("\n");
		await writeFile(configTomlPath, legacyContent, "utf-8");

		// Do NOT create the .toml file
		const removed = await cleanupStaleCodexConfigEntries({
			global: false,
			provider: "codex",
		});

		expect(removed).toEqual([slug]);
		const content = await readFile(configTomlPath, "utf-8");
		expect(content).not.toContain(`[agents.${slug}]`);
		expect(content).not.toContain("config_file");
		// Other sections preserved
		expect(content).toContain("[features]");
		expect(content).toContain("[agents]");
	});

	it("preserves legacy entries when .toml files exist", async () => {
		const slug = "existing_agent";

		// Create the .toml file
		await writeFile(join(agentsDir, `${slug}.toml`), "# exists", "utf-8");

		const legacyContent = [
			`[agents.${slug}]`,
			`description = "Has file"`,
			`config_file = "agents/${slug}.toml"`,
		].join("\n");
		await writeFile(configTomlPath, legacyContent, "utf-8");

		const removed = await cleanupStaleCodexConfigEntries({
			global: false,
			provider: "codex",
		});

		expect(removed).toEqual([]);
		const content = await readFile(configTomlPath, "utf-8");
		expect(content).toContain(`[agents.${slug}]`);
	});

	it("removes both sentinel-managed and legacy stale entries in one pass", async () => {
		const managedSlug = "managed_stale";
		const legacySlug = "legacy_stale";
		const presentSlug = "present_agent";

		// Only create the file for presentSlug
		await writeFile(join(agentsDir, `${presentSlug}.toml`), "# present", "utf-8");

		// Config has: legacy entry (unmanaged) + sentinel block with managed + present entries
		const mixedContent = [
			'model = "gpt-5.4"',
			"",
			`[agents.${legacySlug}]`,
			`description = "Legacy stale"`,
			`config_file = "agents/${legacySlug}.toml"`,
			"",
			SENTINEL_START,
			`[agents.${managedSlug}]`,
			`description = "Managed stale"`,
			`config_file = "agents/${managedSlug}.toml"`,
			"",
			`[agents.${presentSlug}]`,
			`description = "Present"`,
			`config_file = "agents/${presentSlug}.toml"`,
			SENTINEL_END,
			"",
			"[features]",
			"unified_exec = true",
		].join("\n");
		await writeFile(configTomlPath, mixedContent, "utf-8");

		const removed = await cleanupStaleCodexConfigEntries({
			global: false,
			provider: "codex",
		});

		expect(removed.sort()).toEqual([legacySlug, managedSlug].sort());
		const content = await readFile(configTomlPath, "utf-8");
		// Stale entries removed
		expect(content).not.toContain(`[agents.${managedSlug}]`);
		expect(content).not.toContain(`[agents.${legacySlug}]`);
		// Present entry and other sections preserved
		expect(content).toContain(`[agents.${presentSlug}]`);
		expect(content).toContain("[features]");
		// No triple blank lines from removal
		expect(content).not.toMatch(/\n{3,}/);
	});

	it("returns [] without error when config.toml does not exist", async () => {
		// Ensure config.toml is absent
		expect(existsSync(configTomlPath)).toBe(false);

		const removed = await cleanupStaleCodexConfigEntries({
			global: false,
			provider: "codex",
		});

		expect(removed).toEqual([]);
		// Must not have created a config.toml
		expect(existsSync(configTomlPath)).toBe(false);
	});
});
