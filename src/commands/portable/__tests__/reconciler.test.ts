import { describe, expect, it } from "bun:test";
import type { PortableManifest } from "../portable-manifest.js";
import type { PortableRegistryV3 } from "../portable-registry.js";
import type {
	ReconcileInput,
	ReconcileProviderInput,
	SourceItemState,
	TargetFileState,
} from "../reconcile-types.js";
import { reconcile } from "../reconciler.js";
import manifestFixture from "./fixtures/path-migration/manifest.json" with { type: "json" };
import registryPost343Fixture from "./fixtures/path-migration/registry-post-343.json" with {
	type: "json",
};
import registryPre343Fixture from "./fixtures/path-migration/registry-pre-343.json" with {
	type: "json",
};

/**
 * Helper to create source item state
 */
function makeSourceItem(
	item: string,
	type: "agent" | "command" | "skill" | "config" | "rules" | "hooks" = "skill",
	sourceChecksum = "source-abc123",
	convertedChecksums: Record<string, string> = { "claude-code": "converted-abc123" },
	targetChecksums?: Record<string, string>,
): SourceItemState {
	return {
		item,
		type,
		sourceChecksum,
		convertedChecksums,
		targetChecksums,
	};
}

/**
 * Helper to create target file state
 */
function makeTargetState(
	path: string,
	exists = true,
	currentChecksum?: string,
	sectionChecksums?: Record<string, string>,
): TargetFileState {
	return {
		path,
		exists,
		currentChecksum,
		sectionChecksums,
	};
}

/**
 * Helper to create provider config
 */
function makeProvider(provider = "claude-code", global = true): ReconcileProviderInput {
	return { provider, global };
}

/**
 * Helper to create empty registry
 */
function makeRegistry(installations: PortableRegistryV3["installations"] = []): PortableRegistryV3 {
	return {
		version: "3.0",
		installations,
	};
}

/**
 * Helper to create reconcile input
 */
function makeInput(
	sourceItems: SourceItemState[],
	registry: PortableRegistryV3,
	targetStates: Map<string, TargetFileState> = new Map(),
	providerConfigs: ReconcileProviderInput[] = [makeProvider()],
): ReconcileInput {
	return {
		sourceItems,
		registry,
		targetStates,
		providerConfigs,
	};
}

describe("reconciler - core decision matrix", () => {
	it("honors type-scoped provider configs for mixed-scope migrations", () => {
		const agent = makeSourceItem("reviewer", "agent", "agent-source", { codex: "agent-codex" });
		const command = makeSourceItem("plan", "command", "command-source", {
			codex: "command-codex",
		});
		const registry = makeRegistry([]);
		const input = makeInput([agent, command], registry, new Map(), [
			{ provider: "codex", global: false, types: ["agent"] },
			{ provider: "codex", global: true, types: ["command"] },
		]);

		const plan = reconcile(input);

		expect(
			plan.actions.some(
				(action) => action.item === "reviewer" && action.type === "agent" && action.global === true,
			),
		).toBe(false);
		expect(
			plan.actions.some(
				(action) => action.item === "plan" && action.type === "command" && action.global === false,
			),
		).toBe(false);
		expect(plan.actions).toContainEqual(
			expect.objectContaining({ item: "reviewer", type: "agent", global: false }),
		);
		expect(plan.actions).toContainEqual(
			expect.objectContaining({ item: "plan", type: "command", global: true }),
		);
	});

	it("does not orphan-delete inactive types from a scoped provider config", () => {
		const command = makeSourceItem("plan", "command", "command-source", {
			codex: "command-codex",
		});
		const registry = makeRegistry([
			{
				item: "old-agent",
				type: "agent",
				provider: "codex",
				global: true,
				path: "/tmp/.codex/agents/old_agent.toml",
				sourcePath: "/tmp/.claude/agents/old-agent.md",
				sourceChecksum: "old-source",
				targetChecksum: "old-target",
				installSource: "kit",
				installedAt: "2026-01-01T00:00:00.000Z",
			},
		]);
		const input = makeInput([command], registry, new Map(), [
			{ provider: "codex", global: true, types: ["command"] },
		]);

		const plan = reconcile(input);

		expect(
			plan.actions.some(
				(action) =>
					action.action === "delete" && action.item === "old-agent" && action.type === "agent",
			),
		).toBe(false);
	});

	it("case A: new item → install", () => {
		const source = makeSourceItem("new-skill");
		const registry = makeRegistry([]);
		const input = makeInput([source], registry);

		const plan = reconcile(input);

		expect(plan.actions).toHaveLength(1);
		expect(plan.actions[0].action).toBe("install");
		expect(plan.actions[0].item).toBe("new-skill");
		expect(plan.actions[0].reason).toContain("New item");
		expect(plan.summary.install).toBe(1);
	});

	it("case B: unknown checksums, target matches conversion → skip", () => {
		const source = makeSourceItem("existing-skill", "skill", "source-abc", {
			"claude-code": "converted-abc123",
		});
		const registry = makeRegistry([
			{
				item: "existing-skill",
				type: "skill",
				provider: "claude-code",
				global: true,
				path: "/test/skill.md",
				installedAt: "2024-01-01",
				sourcePath: "/src/skill.md",
				sourceChecksum: "unknown",
				targetChecksum: "target-xyz",
				installSource: "kit",
			},
		]);
		const targetStates = new Map([
			["/test/skill.md", makeTargetState("/test/skill.md", true, "converted-abc123")],
		]);
		const input = makeInput([source], registry, targetStates);

		const plan = reconcile(input);

		expect(plan.actions).toHaveLength(1);
		expect(plan.actions[0].action).toBe("skip");
		expect(plan.actions[0].reason).toContain("registry upgrade");
		expect(plan.summary.skip).toBe(1);
	});

	it("case B: unknown checksums, target differs from conversion → update (heal)", () => {
		const source = makeSourceItem("existing-agent", "agent", "source-abc", {
			"claude-code": "converted-correct",
		});
		const registry = makeRegistry([
			{
				item: "existing-agent",
				type: "agent",
				provider: "claude-code",
				global: true,
				path: "/test/agent.md",
				installedAt: "2024-01-01",
				sourcePath: "/src/agent.md",
				sourceChecksum: "unknown",
				targetChecksum: "faulty-target",
				installSource: "kit",
			},
		]);
		const targetStates = new Map([
			["/test/agent.md", makeTargetState("/test/agent.md", true, "faulty-target")],
		]);
		const input = makeInput([source], registry, targetStates);

		const plan = reconcile(input);

		expect(plan.actions).toHaveLength(1);
		expect(plan.actions[0].action).toBe("update");
		expect(plan.actions[0].reason).toContain("Healing stale target");
		expect(plan.summary.update).toBe(1);
	});

	it("case B: unknown checksums, target deleted → install", () => {
		const source = makeSourceItem("existing-agent", "agent", "source-abc", {
			"claude-code": "converted-correct",
		});
		const registry = makeRegistry([
			{
				item: "existing-agent",
				type: "agent",
				provider: "claude-code",
				global: true,
				path: "/test/agent.md",
				installedAt: "2024-01-01",
				sourcePath: "/src/agent.md",
				sourceChecksum: "unknown",
				targetChecksum: "faulty-target",
				installSource: "kit",
			},
		]);
		// No entry in targetStates — file was deleted
		const targetStates = new Map();
		const input = makeInput([source], registry, targetStates);

		const plan = reconcile(input);

		expect(plan.actions).toHaveLength(1);
		expect(plan.actions[0].action).toBe("install");
		expect(plan.actions[0].reason).toContain("reinstalling");
		expect(plan.summary.install).toBe(1);
	});

	it("case B: unknown checksums, target exists=false → install", () => {
		const source = makeSourceItem("existing-agent", "agent", "source-abc", {
			"claude-code": "converted-correct",
		});
		const registry = makeRegistry([
			{
				item: "existing-agent",
				type: "agent",
				provider: "claude-code",
				global: true,
				path: "/test/agent.md",
				installedAt: "2024-01-01",
				sourcePath: "/src/agent.md",
				sourceChecksum: "unknown",
				targetChecksum: "old-target",
				installSource: "kit",
			},
		]);
		// Target state present but file doesn't exist on disk
		const targetStates = new Map([["/test/agent.md", makeTargetState("/test/agent.md", false)]]);
		const input = makeInput([source], registry, targetStates);

		const plan = reconcile(input);

		expect(plan.actions).toHaveLength(1);
		expect(plan.actions[0].action).toBe("install");
		expect(plan.actions[0].reason).toContain("reinstalling");
		expect(plan.summary.install).toBe(1);
	});

	it("case C1: no changes → skip", () => {
		const source = makeSourceItem("stable-skill", "skill", "source-abc", {
			"claude-code": "converted-abc",
		});
		const registry = makeRegistry([
			{
				item: "stable-skill",
				type: "skill",
				provider: "claude-code",
				global: true,
				path: "/test/skill.md",
				installedAt: "2024-01-01",
				sourcePath: "/src/skill.md",
				sourceChecksum: "converted-abc",
				targetChecksum: "target-xyz",
				installSource: "kit",
			},
		]);
		const targetStates = new Map([
			["/test/skill.md", makeTargetState("/test/skill.md", true, "target-xyz")],
		]);
		const input = makeInput([source], registry, targetStates);

		const plan = reconcile(input);

		expect(plan.actions).toHaveLength(1);
		expect(plan.actions[0].action).toBe("skip");
		expect(plan.actions[0].reason).toContain("No changes");
		expect(plan.summary.skip).toBe(1);
	});

	it("case C2: source unchanged, target edited → skip (preserve user)", () => {
		const source = makeSourceItem("edited-skill", "skill", "source-abc", {
			"claude-code": "converted-abc",
		});
		const registry = makeRegistry([
			{
				item: "edited-skill",
				type: "skill",
				provider: "claude-code",
				global: true,
				path: "/test/skill.md",
				installedAt: "2024-01-01",
				sourcePath: "/src/skill.md",
				sourceChecksum: "converted-abc",
				targetChecksum: "target-xyz",
				installSource: "kit",
			},
		]);
		const targetStates = new Map([
			["/test/skill.md", makeTargetState("/test/skill.md", true, "target-user-edit")],
		]);
		const input = makeInput([source], registry, targetStates);

		const plan = reconcile(input);

		expect(plan.actions).toHaveLength(1);
		expect(plan.actions[0].action).toBe("skip");
		expect(plan.actions[0].reason).toContain("User edited, CK unchanged");
		expect(plan.summary.skip).toBe(1);
	});

	it("case C3: source changed, target unchanged → update", () => {
		const source = makeSourceItem("updated-skill", "skill", "source-new", {
			"claude-code": "converted-new",
		});
		const registry = makeRegistry([
			{
				item: "updated-skill",
				type: "skill",
				provider: "claude-code",
				global: true,
				path: "/test/skill.md",
				installedAt: "2024-01-01",
				sourcePath: "/src/skill.md",
				sourceChecksum: "converted-old",
				targetChecksum: "target-xyz",
				installSource: "kit",
			},
		]);
		const targetStates = new Map([
			["/test/skill.md", makeTargetState("/test/skill.md", true, "target-xyz")],
		]);
		const input = makeInput([source], registry, targetStates);

		const plan = reconcile(input);

		expect(plan.actions).toHaveLength(1);
		expect(plan.actions[0].action).toBe("update");
		expect(plan.actions[0].reason).toContain("CK updated, no user edits");
		expect(plan.summary.update).toBe(1);
	});

	it("case C4: both changed → conflict", () => {
		const source = makeSourceItem("conflict-skill", "skill", "source-new", {
			"claude-code": "converted-new",
		});
		const registry = makeRegistry([
			{
				item: "conflict-skill",
				type: "skill",
				provider: "claude-code",
				global: true,
				path: "/test/skill.md",
				installedAt: "2024-01-01",
				sourcePath: "/src/skill.md",
				sourceChecksum: "converted-old",
				targetChecksum: "target-old",
				installSource: "kit",
			},
		]);
		const targetStates = new Map([
			["/test/skill.md", makeTargetState("/test/skill.md", true, "target-new")],
		]);
		const input = makeInput([source], registry, targetStates);

		const plan = reconcile(input);

		expect(plan.actions).toHaveLength(1);
		expect(plan.actions[0].action).toBe("conflict");
		expect(plan.actions[0].reason).toContain("Both CK and user modified");
		expect(plan.summary.conflict).toBe(1);
		expect(plan.hasConflicts).toBe(true);
	});

	it("case C5: target deleted, CK unchanged → skip (respect user)", () => {
		const source = makeSourceItem("deleted-skill", "skill", "source-abc", {
			"claude-code": "converted-abc",
		});
		const registry = makeRegistry([
			{
				item: "deleted-skill",
				type: "skill",
				provider: "claude-code",
				global: true,
				path: "/test/skill.md",
				installedAt: "2024-01-01",
				sourcePath: "/src/skill.md",
				sourceChecksum: "converted-abc",
				targetChecksum: "target-xyz",
				installSource: "kit",
			},
		]);
		const targetStates = new Map([["/test/skill.md", makeTargetState("/test/skill.md", false)]]);
		const input = makeInput([source], registry, targetStates);

		const plan = reconcile(input);

		expect(plan.actions).toHaveLength(1);
		expect(plan.actions[0].action).toBe("skip");
		expect(plan.actions[0].reason).toContain("deleted by user, CK unchanged");
		expect(plan.summary.skip).toBe(1);
	});

	it("case C6: target deleted, CK changed → reinstall", () => {
		const source = makeSourceItem("deleted-updated-skill", "skill", "source-new", {
			"claude-code": "converted-new",
		});
		const registry = makeRegistry([
			{
				item: "deleted-updated-skill",
				type: "skill",
				provider: "claude-code",
				global: true,
				path: "/test/skill.md",
				installedAt: "2024-01-01",
				sourcePath: "/src/skill.md",
				sourceChecksum: "converted-old",
				targetChecksum: "target-xyz",
				installSource: "kit",
			},
		]);
		const targetStates = new Map([["/test/skill.md", makeTargetState("/test/skill.md", false)]]);
		const input = makeInput([source], registry, targetStates);

		const plan = reconcile(input);

		expect(plan.actions).toHaveLength(1);
		expect(plan.actions[0].action).toBe("install");
		expect(plan.actions[0].reason).toContain("Target was deleted, CK has updates");
		expect(plan.summary.install).toBe(1);
	});

	it("matches existing config by provider+scope when config item name differs", () => {
		const source = makeSourceItem("CLAUDE", "config", "config-source", {
			"claude-code": "config-converted",
		});
		const registry = makeRegistry([
			{
				item: "legacy-config-name",
				type: "config",
				provider: "claude-code",
				global: true,
				path: "/test/AGENTS.md",
				installedAt: "2024-01-01",
				sourcePath: "/src/CLAUDE.md",
				sourceChecksum: "config-converted",
				targetChecksum: "target-config",
				installSource: "kit",
			},
		]);
		const targetStates = new Map([
			["/test/AGENTS.md", makeTargetState("/test/AGENTS.md", true, "target-config")],
		]);
		const input = makeInput([source], registry, targetStates);

		const plan = reconcile(input);

		expect(plan.actions).toHaveLength(1);
		expect(plan.actions[0].action).toBe("skip");
		expect(plan.actions[0].item).toBe("CLAUDE");
		expect(plan.summary.delete).toBe(0);
	});

	it("treats merge-single section checksum as unchanged when whole file differs", () => {
		const source = makeSourceItem(
			"CLAUDE",
			"config",
			"raw-config",
			{
				codex: "config-converted",
			},
			{
				codex: "config-section",
			},
		);
		const registry = makeRegistry([
			{
				item: "CLAUDE",
				type: "config",
				provider: "codex",
				global: true,
				path: "/test/AGENTS.md",
				installedAt: "2024-01-01",
				sourcePath: "/src/CLAUDE.md",
				sourceChecksum: "config-converted",
				targetChecksum: "config-section",
				ownedSections: ["config"],
				installSource: "kit",
			},
		]);
		const targetStates = new Map([
			[
				"/test/AGENTS.md",
				makeTargetState("/test/AGENTS.md", true, "whole-file-checksum", {
					"config:config": "config-section",
				}),
			],
		]);
		const input = makeInput([source], registry, targetStates, [makeProvider("codex", true)]);

		const plan = reconcile(input);

		expect(plan.actions).toHaveLength(1);
		expect(plan.actions[0].action).toBe("skip");
		expect(plan.actions[0].reason).toContain("No changes");
	});

	it("backfills merge-single registry checksums when the managed section already matches", () => {
		const source = makeSourceItem(
			"CLAUDE",
			"config",
			"raw-config",
			{ codex: "config-converted" },
			{ codex: "config-section-current" },
		);
		const registry = makeRegistry([
			{
				item: "CLAUDE",
				type: "config",
				provider: "codex",
				global: true,
				path: "/test/AGENTS.md",
				installedAt: "2024-01-01",
				sourcePath: "/src/CLAUDE.md",
				sourceChecksum: "config-converted",
				targetChecksum: "config-section-stale",
				ownedSections: ["config"],
				installSource: "kit",
			},
		]);
		const targetStates = new Map([
			[
				"/test/AGENTS.md",
				makeTargetState("/test/AGENTS.md", true, "whole-file-checksum", {
					"config:config": "config-section-current",
				}),
			],
		]);

		const plan = reconcile(
			makeInput([source], registry, targetStates, [makeProvider("codex", true)]),
		);

		expect(plan.actions).toHaveLength(1);
		expect(plan.actions[0].action).toBe("skip");
		expect(plan.actions[0].reason).toContain("backfilled");
		expect(plan.actions[0].backfillRegistry).toBe(true);
		expect(plan.actions[0].currentTargetChecksum).toBe("config-section-current");
	});

	it("case B: merge-single target matching expected section skips and backfills", () => {
		const source = makeSourceItem(
			"CLAUDE",
			"config",
			"raw-config",
			{ codex: "config-converted" },
			{ codex: "config-section-current" },
		);
		const registry = makeRegistry([
			{
				item: "CLAUDE",
				type: "config",
				provider: "codex",
				global: true,
				path: "/test/AGENTS.md",
				installedAt: "2024-01-01",
				sourcePath: "/src/CLAUDE.md",
				sourceChecksum: "unknown",
				targetChecksum: "unknown",
				ownedSections: ["config"],
				installSource: "kit",
			},
		]);
		const targetStates = new Map([
			[
				"/test/AGENTS.md",
				makeTargetState("/test/AGENTS.md", true, "whole-file-checksum", {
					"config:config": "config-section-current",
				}),
			],
		]);

		const plan = reconcile(
			makeInput([source], registry, targetStates, [makeProvider("codex", true)]),
		);

		expect(plan.actions).toHaveLength(1);
		expect(plan.actions[0].action).toBe("skip");
		expect(plan.actions[0].reason).toContain("registry upgrade");
		expect(plan.actions[0].backfillRegistry).toBe(true);
		expect(plan.actions[0].currentTargetChecksum).toBe("config-section-current");
	});
});

describe("reconciler - orphan detection", () => {
	it("item in registry but not in source → delete (command type)", () => {
		const source = makeSourceItem("active-command", "command");
		const registry = makeRegistry([
			{
				item: "active-command",
				type: "command",
				provider: "claude-code",
				global: true,
				path: "/test/active.md",
				installedAt: "2024-01-01",
				sourcePath: "/src/active.md",
				sourceChecksum: "converted-abc",
				targetChecksum: "target-xyz",
				installSource: "kit",
			},
			{
				item: "orphaned-command",
				type: "command",
				provider: "claude-code",
				global: true,
				path: "/test/orphaned.md",
				installedAt: "2024-01-01",
				sourcePath: "/src/orphaned.md",
				sourceChecksum: "converted-old",
				targetChecksum: "target-old",
				installSource: "kit",
			},
		]);
		const targetStates = new Map([
			["/test/active.md", makeTargetState("/test/active.md", true, "target-xyz")],
			["/test/orphaned.md", makeTargetState("/test/orphaned.md", true, "target-old")],
		]);
		const input = makeInput([source], registry, targetStates);

		const plan = reconcile(input);

		const deleteActions = plan.actions.filter((a) => a.action === "delete");
		expect(deleteActions).toHaveLength(1);
		expect(deleteActions[0].item).toBe("orphaned-command");
		expect(deleteActions[0].reason).toContain("no longer in CK source");
		expect(plan.summary.delete).toBe(1);
	});

	it("manually-installed items not deleted as orphans", () => {
		const registry = makeRegistry([
			{
				item: "manual-skill",
				type: "skill",
				provider: "claude-code",
				global: true,
				path: "/test/manual.md",
				installedAt: "2024-01-01",
				sourcePath: "/custom/manual.md",
				sourceChecksum: "manual-abc",
				targetChecksum: "manual-xyz",
				installSource: "manual",
			},
		]);
		const input = makeInput([], registry, new Map());

		const plan = reconcile(input);

		const deleteActions = plan.actions.filter((a) => a.action === "delete");
		expect(deleteActions).toHaveLength(0);
		expect(plan.summary.delete).toBe(0);
	});

	it("skills not deleted as orphans (directory-based, not in sourceItems)", () => {
		const registry = makeRegistry([
			{
				item: "existing-skill",
				type: "skill",
				provider: "claude-code",
				global: true,
				path: "/test/skill.md",
				installedAt: "2024-01-01",
				sourcePath: "/src/skill.md",
				sourceChecksum: "skill-abc",
				targetChecksum: "skill-xyz",
				installSource: "kit",
			},
		]);
		// Empty sourceItems — skill directories aren't tracked there
		const input = makeInput([], registry, new Map());

		const plan = reconcile(input);

		// Skills should NOT be flagged for deletion even though not in sourceItems
		const deleteActions = plan.actions.filter((a) => a.action === "delete");
		expect(deleteActions).toHaveLength(0);
		expect(plan.summary.delete).toBe(0);
	});

	it("does not detect orphans for providers outside active provider configs", () => {
		const registry = makeRegistry([
			{
				item: "cursor-orphan",
				type: "command",
				provider: "cursor",
				global: true,
				path: "/cursor/orphan.md",
				installedAt: "2024-01-01",
				sourcePath: "/src/orphan.md",
				sourceChecksum: "cursor-abc",
				targetChecksum: "cursor-xyz",
				installSource: "kit",
			},
		]);
		const input = makeInput([], registry, new Map(), [makeProvider("claude-code", true)]);

		const plan = reconcile(input);
		const deleteActions = plan.actions.filter((a) => a.action === "delete");

		expect(deleteActions).toHaveLength(0);
		expect(plan.summary.delete).toBe(0);
	});
});

describe("reconciler - edge cases", () => {
	it("empty registry (first run) → all installs", () => {
		const sources = [
			makeSourceItem("skill-a"),
			makeSourceItem("skill-b"),
			makeSourceItem("skill-c"),
		];
		const registry = makeRegistry([]);
		const input = makeInput(sources, registry);

		const plan = reconcile(input);

		expect(plan.actions).toHaveLength(3);
		expect(plan.actions.every((a) => a.action === "install")).toBe(true);
		expect(plan.summary.install).toBe(3);
	});

	it("empty source → all kit items deleted (non-skill types)", () => {
		const registry = makeRegistry([
			{
				item: "command-a",
				type: "command",
				provider: "claude-code",
				global: true,
				path: "/test/a.md",
				installedAt: "2024-01-01",
				sourcePath: "/src/a.md",
				sourceChecksum: "abc",
				targetChecksum: "xyz",
				installSource: "kit",
			},
			{
				item: "agent-b",
				type: "agent",
				provider: "claude-code",
				global: true,
				path: "/test/b.md",
				installedAt: "2024-01-01",
				sourcePath: "/src/b.md",
				sourceChecksum: "def",
				targetChecksum: "uvw",
				installSource: "kit",
			},
		]);
		const input = makeInput([], registry, new Map());

		const plan = reconcile(input);

		expect(plan.actions).toHaveLength(2);
		expect(plan.actions.every((a) => a.action === "delete")).toBe(true);
		expect(plan.summary.delete).toBe(2);
	});

	it("multiple providers per item → independent actions", () => {
		const source = makeSourceItem("multi-skill", "skill", "source-abc", {
			"claude-code": "cc-new",
			cursor: "cursor-new",
		});
		const registry = makeRegistry([
			{
				item: "multi-skill",
				type: "skill",
				provider: "claude-code",
				global: true,
				path: "/cc/skill.md",
				installedAt: "2024-01-01",
				sourcePath: "/src/skill.md",
				sourceChecksum: "cc-old",
				targetChecksum: "cc-target",
				installSource: "kit",
			},
			{
				item: "multi-skill",
				type: "skill",
				provider: "cursor",
				global: true,
				path: "/cursor/skill.md",
				installedAt: "2024-01-01",
				sourcePath: "/src/skill.md",
				sourceChecksum: "cursor-old",
				targetChecksum: "cursor-target",
				installSource: "kit",
			},
		]);
		const targetStates = new Map([
			["/cc/skill.md", makeTargetState("/cc/skill.md", true, "cc-target")],
			["/cursor/skill.md", makeTargetState("/cursor/skill.md", true, "cursor-target")],
		]);
		const providers = [makeProvider("claude-code"), makeProvider("cursor")];
		const input = makeInput([source], registry, targetStates, providers);

		const plan = reconcile(input);

		expect(plan.actions).toHaveLength(2);
		expect(plan.actions.every((a) => a.action === "update")).toBe(true);
		expect(plan.summary.update).toBe(2);
	});

	it("new provider for existing item → install", () => {
		const source = makeSourceItem("existing-skill", "skill", "source-abc", {
			"claude-code": "cc-abc",
			cursor: "cursor-abc",
		});
		const registry = makeRegistry([
			{
				item: "existing-skill",
				type: "skill",
				provider: "claude-code",
				global: true,
				path: "/cc/skill.md",
				installedAt: "2024-01-01",
				sourcePath: "/src/skill.md",
				sourceChecksum: "cc-abc",
				targetChecksum: "cc-xyz",
				installSource: "kit",
			},
		]);
		const targetStates = new Map([
			["/cc/skill.md", makeTargetState("/cc/skill.md", true, "cc-xyz")],
		]);
		const providers = [makeProvider("claude-code"), makeProvider("cursor")];
		const input = makeInput([source], registry, targetStates, providers);

		const plan = reconcile(input);

		const installActions = plan.actions.filter((a) => a.action === "install");
		expect(installActions).toHaveLength(1);
		expect(installActions[0].provider).toBe("cursor");
		expect(installActions[0].reason).toContain("New provider");
	});
});

describe("reconciler - plan summary", () => {
	it("computes summary counts correctly", () => {
		const sources = [
			makeSourceItem("new-skill", "skill", "new-abc", { "claude-code": "new-abc" }),
			makeSourceItem("update-skill", "skill", "update-new", { "claude-code": "update-new" }),
			makeSourceItem("skip-skill", "skill", "skip-abc", { "claude-code": "skip-abc" }),
			makeSourceItem("conflict-skill", "skill", "conf-new", { "claude-code": "conf-new" }),
		];
		const registry = makeRegistry([
			{
				item: "update-skill",
				type: "skill",
				provider: "claude-code",
				global: true,
				path: "/test/update.md",
				installedAt: "2024-01-01",
				sourcePath: "/src/update.md",
				sourceChecksum: "update-old",
				targetChecksum: "update-target",
				installSource: "kit",
			},
			{
				item: "skip-skill",
				type: "skill",
				provider: "claude-code",
				global: true,
				path: "/test/skip.md",
				installedAt: "2024-01-01",
				sourcePath: "/src/skip.md",
				sourceChecksum: "skip-abc",
				targetChecksum: "skip-target",
				installSource: "kit",
			},
			{
				item: "conflict-skill",
				type: "skill",
				provider: "claude-code",
				global: true,
				path: "/test/conflict.md",
				installedAt: "2024-01-01",
				sourcePath: "/src/conflict.md",
				sourceChecksum: "conf-old",
				targetChecksum: "conf-old-target",
				installSource: "kit",
			},
			{
				item: "orphan-command",
				type: "command",
				provider: "claude-code",
				global: true,
				path: "/test/orphan.md",
				installedAt: "2024-01-01",
				sourcePath: "/src/orphan.md",
				sourceChecksum: "orphan-abc",
				targetChecksum: "orphan-xyz",
				installSource: "kit",
			},
		]);
		const targetStates = new Map([
			["/test/update.md", makeTargetState("/test/update.md", true, "update-target")],
			["/test/skip.md", makeTargetState("/test/skip.md", true, "skip-target")],
			["/test/conflict.md", makeTargetState("/test/conflict.md", true, "conf-new-target")],
			["/test/orphan.md", makeTargetState("/test/orphan.md", true, "orphan-xyz")],
		]);
		const input = makeInput(sources, registry, targetStates);

		const plan = reconcile(input);

		expect(plan.summary.install).toBe(1);
		expect(plan.summary.update).toBe(1);
		expect(plan.summary.skip).toBe(1);
		expect(plan.summary.conflict).toBe(1);
		expect(plan.summary.delete).toBe(1);
		expect(plan.hasConflicts).toBe(true);
	});

	it("hasConflicts false when no conflicts", () => {
		const source = makeSourceItem("new-skill");
		const registry = makeRegistry([]);
		const input = makeInput([source], registry);

		const plan = reconcile(input);

		expect(plan.hasConflicts).toBe(false);
	});
});

describe("reconciler - force mode", () => {
	it("force + target deleted + source unchanged → install", () => {
		const source = makeSourceItem("deleted-skill", "skill", "source-abc", {
			"claude-code": "converted-abc",
		});
		const registry = makeRegistry([
			{
				item: "deleted-skill",
				type: "skill",
				provider: "claude-code",
				global: true,
				path: "/test/skill.md",
				installedAt: "2024-01-01",
				sourcePath: "/src/skill.md",
				sourceChecksum: "converted-abc",
				targetChecksum: "target-xyz",
				installSource: "kit",
			},
		]);
		const targetStates = new Map([["/test/skill.md", makeTargetState("/test/skill.md", false)]]);
		const input = makeInput([source], registry, targetStates);
		input.force = true;

		const plan = reconcile(input);

		expect(plan.actions).toHaveLength(1);
		expect(plan.actions[0].action).toBe("install");
		expect(plan.actions[0].reason).toContain("Force reinstall");
		expect(plan.summary.install).toBe(1);
	});

	it("force + user edited + source unchanged → install", () => {
		const source = makeSourceItem("edited-skill", "skill", "source-abc", {
			"claude-code": "converted-abc",
		});
		const registry = makeRegistry([
			{
				item: "edited-skill",
				type: "skill",
				provider: "claude-code",
				global: true,
				path: "/test/skill.md",
				installedAt: "2024-01-01",
				sourcePath: "/src/skill.md",
				sourceChecksum: "converted-abc",
				targetChecksum: "target-xyz",
				installSource: "kit",
			},
		]);
		const targetStates = new Map([
			["/test/skill.md", makeTargetState("/test/skill.md", true, "target-user-edit")],
		]);
		const input = makeInput([source], registry, targetStates);
		input.force = true;

		const plan = reconcile(input);

		expect(plan.actions).toHaveLength(1);
		expect(plan.actions[0].action).toBe("install");
		expect(plan.actions[0].reason).toContain("Force overwrite");
		expect(plan.summary.install).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// windsurf+cursor path migration (Phase 03 verification)
// Fixtures: src/commands/portable/__tests__/fixtures/path-migration/
// Manifest: 3.37.0 forward entries (gemini-cli, windsurf, cursor) +
//           3.43.0 reversed entries (windsurf .agents→.windsurf, cursor .agents→.cursor)
// ---------------------------------------------------------------------------

/**
 * Build a minimal ReconcileInput for path-migration tests.
 * sourceItems is intentionally empty — detectPathMigrations only walks
 * the registry, it does not need matching source items.
 */
function makeMigrationInput(
	registry: PortableRegistryV3,
	manifest: PortableManifest,
	providerConfigs: ReconcileProviderInput[] = [
		{ provider: "cursor", global: false },
		{ provider: "windsurf", global: false },
	],
): ReconcileInput {
	return {
		sourceItems: [],
		registry,
		targetStates: new Map(),
		manifest,
		providerConfigs,
	};
}

/**
 * Cast JSON fixture to PortableRegistryV3.
 * Fixtures are validated to match the schema; cast is safe here.
 */
function asRegistry(raw: unknown): PortableRegistryV3 {
	return raw as PortableRegistryV3;
}

describe("reconciler - windsurf+cursor path migration (3.43.0)", () => {
	// Test 1: cursor upgrade emits delete for .agents/skills/foo
	it("cursor 3.43 upgrade: emits delete for skill at .agents/skills", () => {
		const registry = asRegistry(registryPre343Fixture);
		// Only keep the cursor entry for isolation
		const cursorOnlyRegistry: PortableRegistryV3 = {
			...registry,
			installations: registry.installations.filter((i) => i.provider === "cursor"),
		};

		const plan = reconcile(
			makeMigrationInput(cursorOnlyRegistry, manifestFixture as PortableManifest),
		);

		const migrationDeletes = plan.actions.filter(
			(a) => a.action === "delete" && a.reasonCode === "path-migrated-cleanup",
		);
		expect(migrationDeletes).toHaveLength(1);
		expect(migrationDeletes[0].item).toBe("foo");
		expect(migrationDeletes[0].provider).toBe("cursor");
		expect(migrationDeletes[0].targetPath).toContain(".agents/skills/foo");
	});

	// Test 2: windsurf upgrade emits delete for .agents/skills/bar (project-relative path)
	it("windsurf 3.43 upgrade (project path): emits delete for skill at .agents/skills", () => {
		const registry = asRegistry(registryPre343Fixture);
		const windsurfOnlyRegistry: PortableRegistryV3 = {
			...registry,
			installations: registry.installations.filter((i) => i.provider === "windsurf"),
		};

		const plan = reconcile(
			makeMigrationInput(windsurfOnlyRegistry, manifestFixture as PortableManifest),
		);

		const migrationDeletes = plan.actions.filter(
			(a) => a.action === "delete" && a.reasonCode === "path-migrated-cleanup",
		);
		expect(migrationDeletes).toHaveLength(1);
		expect(migrationDeletes[0].item).toBe("bar");
		expect(migrationDeletes[0].provider).toBe("windsurf");
		expect(migrationDeletes[0].targetPath).toContain(".agents/skills/bar");
	});

	// Test 3: windsurf upgrade emits delete for global path containing .agents/skills
	it("windsurf 3.43 upgrade (global path): emits delete for global skill at .agents/skills", () => {
		const globalRegistry: PortableRegistryV3 = {
			version: "3.0",
			appliedManifestVersion: "3.42.5",
			installations: [
				{
					item: "baz",
					type: "skill",
					provider: "windsurf",
					global: true,
					// Simulate absolute global path containing .agents/skills segments
					path: "/home/user/.agents/skills/baz",
					installedAt: "2024-01-01T00:00:00.000Z",
					sourcePath: "skills/baz",
					sourceChecksum: "source-baz",
					targetChecksum: "target-baz",
					installSource: "kit",
				},
			],
		};

		const plan = reconcile(
			makeMigrationInput(globalRegistry, manifestFixture as PortableManifest, [
				{ provider: "windsurf", global: true },
			]),
		);

		const migrationDeletes = plan.actions.filter(
			(a) => a.action === "delete" && a.reasonCode === "path-migrated-cleanup",
		);
		expect(migrationDeletes).toHaveLength(1);
		expect(migrationDeletes[0].item).toBe("baz");
		expect(migrationDeletes[0].provider).toBe("windsurf");
		expect(migrationDeletes[0].targetPath).toBe("/home/user/.agents/skills/baz");
	});

	// Test 4: idempotency — registry already at native paths, appliedManifestVersion=3.43.0
	it("idempotent: no migration deletes when registry already at native paths (post-3.43.0)", () => {
		const registry = asRegistry(registryPost343Fixture);

		const plan = reconcile(makeMigrationInput(registry, manifestFixture as PortableManifest));

		const migrationDeletes = plan.actions.filter(
			(a) => a.action === "delete" && a.reasonCode === "path-migrated-cleanup",
		);
		expect(migrationDeletes).toHaveLength(0);
	});

	// Test 5: semver boundary — appliedManifestVersion === cliVersion === 3.43.0 → no re-trigger
	it("semver boundary: appliedManifestVersion === 3.43.0 does not re-trigger reversed entries", () => {
		// Registry at 3.43.0 but still has .agents/skills paths (edge-case data)
		const boundaryRegistry: PortableRegistryV3 = {
			version: "3.0",
			appliedManifestVersion: "3.43.0",
			installations: [
				{
					item: "edge",
					type: "skill",
					provider: "cursor",
					global: false,
					path: ".agents/skills/edge",
					installedAt: "2024-01-01T00:00:00.000Z",
					sourcePath: "skills/edge",
					sourceChecksum: "source-edge",
					targetChecksum: "target-edge",
					installSource: "kit",
				},
			],
		};

		const plan = reconcile(
			makeMigrationInput(boundaryRegistry, manifestFixture as PortableManifest),
		);

		// entry.since (3.43.0) must be STRICTLY GREATER than appliedVersion (3.43.0)
		// getApplicableEntries uses: since > applied && since <= current
		// 3.43.0 > 3.43.0 is false → entry not applicable → no delete
		const migrationDeletes = plan.actions.filter(
			(a) => a.action === "delete" && a.reasonCode === "path-migrated-cleanup",
		);
		expect(migrationDeletes).toHaveLength(0);
	});

	// Test 6: old 3.37.0 entries and new 3.43.0 entries coexist correctly
	it("3.37.0 and 3.43.0 entries coexist: both sets filter independently", () => {
		// User at 3.37.0 applied — installs exist at .agents/skills (forward migration happened)
		// Now upgrading to 3.43.0 — reversed entries should apply
		const mixedRegistry: PortableRegistryV3 = {
			version: "3.0",
			appliedManifestVersion: "3.37.0",
			installations: [
				{
					item: "alpha",
					type: "skill",
					provider: "cursor",
					global: false,
					path: ".agents/skills/alpha",
					installedAt: "2024-01-01T00:00:00.000Z",
					sourcePath: "skills/alpha",
					sourceChecksum: "source-alpha",
					targetChecksum: "target-alpha",
					installSource: "kit",
				},
				{
					item: "beta",
					type: "skill",
					provider: "windsurf",
					global: false,
					path: ".agents/skills/beta",
					installedAt: "2024-01-01T00:00:00.000Z",
					sourcePath: "skills/beta",
					sourceChecksum: "source-beta",
					targetChecksum: "target-beta",
					installSource: "kit",
				},
			],
		};

		const plan = reconcile(makeMigrationInput(mixedRegistry, manifestFixture as PortableManifest));

		// appliedManifestVersion=3.37.0, cliVersion=3.43.0
		// 3.43.0 entries: since(3.43.0) > applied(3.37.0) && since(3.43.0) <= current(3.43.0) → TRUE
		// 3.37.0 entries: since(3.37.0) > applied(3.37.0) is FALSE → not applicable
		// So only the two 3.43.0 reversed entries fire, matching both .agents/skills installs
		const migrationDeletes = plan.actions.filter(
			(a) => a.action === "delete" && a.reasonCode === "path-migrated-cleanup",
		);
		expect(migrationDeletes).toHaveLength(2);

		const deletedItems = migrationDeletes.map((a) => a.item).sort();
		expect(deletedItems).toEqual(["alpha", "beta"]);

		const deletedProviders = migrationDeletes.map((a) => a.provider).sort();
		expect(deletedProviders).toEqual(["cursor", "windsurf"]);
	});

	// Test 7: no matching installs → zero delete actions
	it("no matching installs: no migration delete actions when registry is empty", () => {
		const emptyRegistry: PortableRegistryV3 = {
			version: "3.0",
			appliedManifestVersion: "3.42.5",
			installations: [],
		};

		const plan = reconcile(makeMigrationInput(emptyRegistry, manifestFixture as PortableManifest));

		const migrationDeletes = plan.actions.filter(
			(a) => a.action === "delete" && a.reasonCode === "path-migrated-cleanup",
		);
		expect(migrationDeletes).toHaveLength(0);
		expect(plan.summary.delete).toBe(0);
	});

	// Test 8: mixed registry — only .agents/skills entry gets delete, .cursor/skills entry is untouched
	it("mixed registry: only .agents/skills entry gets migration delete, native-path entry is unaffected", () => {
		const mixedRegistry: PortableRegistryV3 = {
			version: "3.0",
			appliedManifestVersion: "3.42.5",
			installations: [
				{
					// Old path — should be cleaned up
					item: "old-skill",
					type: "skill",
					provider: "cursor",
					global: false,
					path: ".agents/skills/old-skill",
					installedAt: "2024-01-01T00:00:00.000Z",
					sourcePath: "skills/old-skill",
					sourceChecksum: "source-old",
					targetChecksum: "target-old",
					installSource: "kit",
				},
				{
					// Already at native path — must NOT be deleted by migration
					item: "native-skill",
					type: "skill",
					provider: "cursor",
					global: false,
					path: ".cursor/skills/native-skill",
					installedAt: "2024-01-01T00:00:00.000Z",
					sourcePath: "skills/native-skill",
					sourceChecksum: "source-native",
					targetChecksum: "target-native",
					installSource: "kit",
				},
			],
		};

		const plan = reconcile(makeMigrationInput(mixedRegistry, manifestFixture as PortableManifest));

		const migrationDeletes = plan.actions.filter(
			(a) => a.action === "delete" && a.reasonCode === "path-migrated-cleanup",
		);
		expect(migrationDeletes).toHaveLength(1);
		expect(migrationDeletes[0].item).toBe("old-skill");
		expect(migrationDeletes[0].targetPath).toContain(".agents/skills/old-skill");

		// native-skill must appear in actions but NOT as a migration delete
		const nativeAction = plan.actions.find((a) => a.item === "native-skill");
		// native-skill is in the registry but not in sourceItems, so it becomes an orphan delete
		// OR it may not appear at all — either way, it must not be a path-migrated-cleanup
		if (nativeAction) {
			expect(nativeAction.reasonCode).not.toBe("path-migrated-cleanup");
		}
	});
});
