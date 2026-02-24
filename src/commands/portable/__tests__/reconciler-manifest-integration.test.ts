/**
 * Integration tests for manifest-driven rename and path migration detection
 */
import { describe, expect, test } from "bun:test";
import type { PortableManifest } from "../portable-manifest.js";
import type { PortableRegistryV3 } from "../portable-registry.js";
import type { ReconcileInput } from "../reconcile-types.js";
import { reconcile } from "../reconciler.js";

describe("Manifest-driven renames", () => {
	test("detects rename from manifest and generates delete action", () => {
		const manifest: PortableManifest = {
			version: "1.0",
			cliVersion: "2.12.0",
			renames: [{ from: "skills/old-skill.md", to: "skills/new-skill.md", since: "2.11.0" }],
			providerPathMigrations: [],
			sectionRenames: [],
		};

		const registry: PortableRegistryV3 = {
			version: "3.0",
			installations: [
				{
					item: "old-skill",
					type: "skill",
					provider: "codex",
					global: true,
					path: "/home/user/.codex/skills/old-skill.md",
					installedAt: "2024-01-01T00:00:00.000Z",
					sourcePath: "skills/old-skill.md",
					sourceChecksum: "abc123",
					targetChecksum: "def456",
					installSource: "kit",
				},
			],
			appliedManifestVersion: "2.10.0", // Last applied was 2.10.0
		};

		const input: ReconcileInput = {
			sourceItems: [],
			registry,
			targetStates: new Map(),
			manifest,
			providerConfigs: [],
		};

		const plan = reconcile(input);

		// Should have delete action for renamed item
		const deleteActions = plan.actions.filter((a) => a.action === "delete");
		expect(deleteActions.length).toBeGreaterThan(0);

		const renamedDelete = deleteActions.find((a) => a.item === "old-skill");
		expect(renamedDelete).toBeDefined();
		expect(renamedDelete?.reason).toContain("Renamed");
		expect(renamedDelete?.previousItem).toBe("old-skill");
	});

	test("skips rename if already applied", () => {
		const manifest: PortableManifest = {
			version: "1.0",
			cliVersion: "2.12.0",
			renames: [{ from: "skills/old-skill.md", to: "skills/new-skill.md", since: "2.11.0" }],
			providerPathMigrations: [],
			sectionRenames: [],
		};

		const registry: PortableRegistryV3 = {
			version: "3.0",
			installations: [],
			appliedManifestVersion: "2.12.0", // Already applied up to 2.12.0
		};

		const input: ReconcileInput = {
			sourceItems: [],
			registry,
			targetStates: new Map(),
			manifest,
			providerConfigs: [],
		};

		const plan = reconcile(input);

		// No delete actions for renames (already applied)
		const deleteActions = plan.actions.filter((a) => a.reason.includes("Renamed"));
		expect(deleteActions.length).toBe(0);
	});

	test("rejects path traversal in manifest renames", () => {
		const manifest: PortableManifest = {
			version: "1.0",
			cliVersion: "2.12.0",
			renames: [
				// This would be rejected by schema, but test runtime defense
				{ from: "../evil.md" as any, to: "skills/safe.md", since: "2.11.0" },
			],
			providerPathMigrations: [],
			sectionRenames: [],
		};

		const registry: PortableRegistryV3 = {
			version: "3.0",
			installations: [
				{
					item: "evil",
					type: "skill",
					provider: "codex",
					global: true,
					path: "/evil/path",
					installedAt: "2024-01-01T00:00:00.000Z",
					sourcePath: "../evil.md",
					sourceChecksum: "abc",
					targetChecksum: "def",
					installSource: "kit",
				},
			],
		};

		const input: ReconcileInput = {
			sourceItems: [],
			registry,
			targetStates: new Map(),
			manifest,
			providerConfigs: [],
		};

		const plan = reconcile(input);

		// Should skip suspicious rename (no delete action)
		const deleteActions = plan.actions.filter((a) => a.reason.includes("Renamed"));
		expect(deleteActions.length).toBe(0);
	});
});

describe("Manifest-driven path migrations", () => {
	test("detects provider path migration from manifest", () => {
		const manifest: PortableManifest = {
			version: "1.0",
			cliVersion: "2.12.0",
			renames: [],
			providerPathMigrations: [
				{
					provider: "codex",
					type: "skill",
					from: ".codex/skills/",
					to: ".agents/skills/",
					since: "2.11.0",
				},
			],
			sectionRenames: [],
		};

		const registry: PortableRegistryV3 = {
			version: "3.0",
			installations: [
				{
					item: "my-skill",
					type: "skill",
					provider: "codex",
					global: true,
					path: "/home/user/.codex/skills/my-skill.md",
					installedAt: "2024-01-01T00:00:00.000Z",
					sourcePath: "skills/my-skill.md",
					sourceChecksum: "abc123",
					targetChecksum: "def456",
					installSource: "kit",
				},
			],
			appliedManifestVersion: "2.10.0",
		};

		const input: ReconcileInput = {
			sourceItems: [],
			registry,
			targetStates: new Map(),
			manifest,
			providerConfigs: [],
		};

		const plan = reconcile(input);

		// Should have delete action for migrated path
		const deleteActions = plan.actions.filter((a) => a.action === "delete");
		expect(deleteActions.length).toBeGreaterThan(0);

		const migratedDelete = deleteActions.find((a) => a.item === "my-skill");
		expect(migratedDelete).toBeDefined();
		expect(migratedDelete?.reason).toContain("Provider path migrated");
		expect(migratedDelete?.previousPath).toBe("/home/user/.codex/skills/my-skill.md");
	});

	test("skips path migration if already applied", () => {
		const manifest: PortableManifest = {
			version: "1.0",
			cliVersion: "2.12.0",
			renames: [],
			providerPathMigrations: [
				{
					provider: "codex",
					type: "skill",
					from: ".codex/skills/",
					to: ".agents/skills/",
					since: "2.11.0",
				},
			],
			sectionRenames: [],
		};

		const registry: PortableRegistryV3 = {
			version: "3.0",
			installations: [],
			appliedManifestVersion: "2.12.0", // Already applied
		};

		const input: ReconcileInput = {
			sourceItems: [],
			registry,
			targetStates: new Map(),
			manifest,
			providerConfigs: [],
		};

		const plan = reconcile(input);

		// No delete actions for migrations (already applied)
		const deleteActions = plan.actions.filter((a) => a.reason.includes("Provider path migrated"));
		expect(deleteActions.length).toBe(0);
	});
});

describe("No manifest fallback", () => {
	test("works without manifest (null manifest)", () => {
		const registry: PortableRegistryV3 = {
			version: "3.0",
			installations: [],
		};

		const input: ReconcileInput = {
			sourceItems: [],
			registry,
			targetStates: new Map(),
			manifest: null,
			providerConfigs: [],
		};

		const plan = reconcile(input);

		// Should complete without errors
		expect(plan.summary.delete).toBe(0);
	});

	test("works without manifest (undefined manifest)", () => {
		const registry: PortableRegistryV3 = {
			version: "3.0",
			installations: [],
		};

		const input: ReconcileInput = {
			sourceItems: [],
			registry,
			targetStates: new Map(),
			manifest: undefined,
			providerConfigs: [],
		};

		const plan = reconcile(input);

		// Should complete without errors
		expect(plan.summary.delete).toBe(0);
	});
});
