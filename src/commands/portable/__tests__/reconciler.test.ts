import { describe, expect, it } from "bun:test";
import type { PortableRegistryV3 } from "../portable-registry.js";
import type {
	ReconcileInput,
	ReconcileProviderInput,
	SourceItemState,
	TargetFileState,
} from "../reconcile-types.js";
import { reconcile } from "../reconciler.js";

/**
 * Helper to create source item state
 */
function makeSourceItem(
	item: string,
	type: "agent" | "command" | "skill" | "config" | "rules" = "skill",
	sourceChecksum = "source-abc123",
	convertedChecksums: Record<string, string> = { "claude-code": "converted-abc123" },
): SourceItemState {
	return {
		item,
		type,
		sourceChecksum,
		convertedChecksums,
	};
}

/**
 * Helper to create target file state
 */
function makeTargetState(path: string, exists = true, currentChecksum?: string): TargetFileState {
	return {
		path,
		exists,
		currentChecksum,
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

	it("case B: unknown checksums (v2→v3 migration) → skip", () => {
		const source = makeSourceItem("existing-skill");
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
			["/test/skill.md", makeTargetState("/test/skill.md", true, "target-xyz")],
		]);
		const input = makeInput([source], registry, targetStates);

		const plan = reconcile(input);

		expect(plan.actions).toHaveLength(1);
		expect(plan.actions[0].action).toBe("skip");
		expect(plan.actions[0].reason).toContain("First run after registry upgrade");
		expect(plan.summary.skip).toBe(1);
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
