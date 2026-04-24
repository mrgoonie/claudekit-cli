/**
 * Tests for ReconcileReason taxonomy, empty-dir override, and banner emission.
 * Covers:
 *   - reasonCode populated on all decision paths
 *   - applyEmptyDirOverride: flips user-deleted-respected → install when dir is empty
 *   - applyEmptyDirOverride: does NOT flip no-changes or user-edits-preserved
 *   - respectDeletions flag: skips flip, emits empty-dir-respected banner
 *   - isDirectoryItem flag for skills
 *   - banners[] always an array (never undefined) in ReconcilePlan
 */
import { describe, expect, it } from "bun:test";
import type { PortableRegistryV3 } from "../portable-registry.js";
import {
	type ReconcileInput,
	type ReconcileProviderInput,
	type SourceItemState,
	type TargetDirectoryState,
	type TargetFileState,
	getReasonCopy,
} from "../reconcile-types.js";
import { reconcile } from "../reconciler.js";

// ---------------------------------------------------------------------------
// Helpers (mirrors reconciler.test.ts helpers for consistency)
// ---------------------------------------------------------------------------

function makeSourceItem(
	item: string,
	type: "agent" | "command" | "skill" | "config" | "rules" | "hooks" = "skill",
	sourceChecksum = "source-abc123",
	convertedChecksums: Record<string, string> = { "claude-code": "converted-abc123" },
	targetChecksums?: Record<string, string>,
): SourceItemState {
	return { item, type, sourceChecksum, convertedChecksums, targetChecksums };
}

function makeTargetState(path: string, exists = true, currentChecksum?: string): TargetFileState {
	return { path, exists, currentChecksum };
}

function makeProvider(provider = "claude-code", global = true): ReconcileProviderInput {
	return { provider, global };
}

function makeRegistry(installations: PortableRegistryV3["installations"] = []): PortableRegistryV3 {
	return { version: "3.0", installations };
}

function makeInput(
	sourceItems: SourceItemState[],
	registry: PortableRegistryV3,
	targetStates: Map<string, TargetFileState> = new Map(),
	providerConfigs: ReconcileProviderInput[] = [makeProvider()],
	extra: Partial<ReconcileInput> = {},
): ReconcileInput {
	return { sourceItems, registry, targetStates, providerConfigs, ...extra };
}

/** Build a registry entry that exactly matches source checksums (unchanged state) */
function makeRegistryEntry(
	item: string,
	type: "agent" | "command" | "skill" | "config" | "rules" | "hooks",
	provider = "claude-code",
	global = true,
	sourceChecksum = "converted-abc123",
	targetChecksum = "target-xyz",
	path = "/test/skill.md",
): PortableRegistryV3["installations"][0] {
	return {
		item,
		type,
		provider,
		global,
		path,
		installedAt: "2024-01-01",
		sourcePath: `/src/${item}.md`,
		sourceChecksum,
		targetChecksum,
		installSource: "kit",
	};
}

/**
 * Build a TargetDirectoryState representing a missing/empty directory.
 */
function makeEmptyDirState(
	provider = "claude-code",
	type: TargetDirectoryState["type"] = "skill",
	global = true,
	path = "/home/user/.claude/skills",
): TargetDirectoryState {
	return { provider, type, global, path, exists: false, isEmpty: true, fileCount: 0 };
}

// ---------------------------------------------------------------------------
// Reason code mapping — one assertion per existing decision path
// ---------------------------------------------------------------------------

describe("reconciler - reason codes", () => {
	it("new item → reasonCode new-item", () => {
		const plan = reconcile(makeInput([makeSourceItem("brand-new")], makeRegistry([])));
		expect(plan.actions[0].action).toBe("install");
		expect(plan.actions[0].reasonCode).toBe("new-item");
		expect(plan.actions[0].reasonCopy).toBe(getReasonCopy("new-item"));
	});

	it("new provider for existing item → reasonCode new-provider-for-item", () => {
		const source = makeSourceItem("existing", "skill", "src", {
			"claude-code": "cc-abc",
			cursor: "cur-abc",
		});
		const registry = makeRegistry([makeRegistryEntry("existing", "skill", "claude-code")]);
		const targetStates = new Map([
			["/test/skill.md", makeTargetState("/test/skill.md", true, "target-xyz")],
		]);
		const plan = reconcile(
			makeInput([source], registry, targetStates, [
				makeProvider("claude-code"),
				makeProvider("cursor"),
			]),
		);

		const install = plan.actions.find((a) => a.provider === "cursor" && a.action === "install");
		expect(install?.reasonCode).toBe("new-provider-for-item");
	});

	it("no changes → reasonCode no-changes", () => {
		const source = makeSourceItem("stable", "skill", "src", { "claude-code": "converted-abc123" });
		const registry = makeRegistry([
			makeRegistryEntry("stable", "skill", "claude-code", true, "converted-abc123", "target-xyz"),
		]);
		const targetStates = new Map([
			["/test/skill.md", makeTargetState("/test/skill.md", true, "target-xyz")],
		]);
		const plan = reconcile(makeInput([source], registry, targetStates));

		expect(plan.actions[0].action).toBe("skip");
		expect(plan.actions[0].reasonCode).toBe("no-changes");
	});

	it("user edits preserved → reasonCode user-edits-preserved", () => {
		const source = makeSourceItem("edited", "skill", "src", { "claude-code": "converted-abc123" });
		const registry = makeRegistry([
			makeRegistryEntry("edited", "skill", "claude-code", true, "converted-abc123", "target-xyz"),
		]);
		const targetStates = new Map([
			["/test/skill.md", makeTargetState("/test/skill.md", true, "target-user-edits")],
		]);
		const plan = reconcile(makeInput([source], registry, targetStates));

		expect(plan.actions[0].action).toBe("skip");
		expect(plan.actions[0].reasonCode).toBe("user-edits-preserved");
	});

	it("user deleted, CK unchanged → reasonCode user-deleted-respected", () => {
		const source = makeSourceItem("deleted", "skill", "src", { "claude-code": "converted-abc123" });
		const registry = makeRegistry([
			makeRegistryEntry("deleted", "skill", "claude-code", true, "converted-abc123", "target-xyz"),
		]);
		const targetStates = new Map([["/test/skill.md", makeTargetState("/test/skill.md", false)]]);
		const plan = reconcile(makeInput([source], registry, targetStates));

		expect(plan.actions[0].action).toBe("skip");
		expect(plan.actions[0].reasonCode).toBe("user-deleted-respected");
	});

	it("target deleted, CK changed → reasonCode target-deleted-source-changed", () => {
		const source = makeSourceItem("del-upd", "skill", "src", { "claude-code": "converted-NEW" });
		const registry = makeRegistry([
			makeRegistryEntry("del-upd", "skill", "claude-code", true, "converted-OLD", "target-xyz"),
		]);
		const targetStates = new Map([["/test/skill.md", makeTargetState("/test/skill.md", false)]]);
		const plan = reconcile(makeInput([source], registry, targetStates));

		expect(plan.actions[0].action).toBe("install");
		expect(plan.actions[0].reasonCode).toBe("target-deleted-source-changed");
	});

	it("source changed, target unchanged → reasonCode source-changed", () => {
		const source = makeSourceItem("updated", "skill", "src", { "claude-code": "converted-NEW" });
		const registry = makeRegistry([
			makeRegistryEntry("updated", "skill", "claude-code", true, "converted-OLD", "target-xyz"),
		]);
		const targetStates = new Map([
			["/test/skill.md", makeTargetState("/test/skill.md", true, "target-xyz")],
		]);
		const plan = reconcile(makeInput([source], registry, targetStates));

		expect(plan.actions[0].action).toBe("update");
		expect(plan.actions[0].reasonCode).toBe("source-changed");
	});

	it("both changed → reasonCode both-changed", () => {
		const source = makeSourceItem("conflict", "skill", "src", { "claude-code": "converted-NEW" });
		const registry = makeRegistry([
			makeRegistryEntry("conflict", "skill", "claude-code", true, "converted-OLD", "target-OLD"),
		]);
		const targetStates = new Map([
			["/test/skill.md", makeTargetState("/test/skill.md", true, "target-NEW")],
		]);
		const plan = reconcile(makeInput([source], registry, targetStates));

		expect(plan.actions[0].action).toBe("conflict");
		expect(plan.actions[0].reasonCode).toBe("both-changed");
	});

	it("force + deleted → reasonCode force-reinstall", () => {
		const source = makeSourceItem("force-del", "skill", "src", {
			"claude-code": "converted-abc123",
		});
		const registry = makeRegistry([
			makeRegistryEntry(
				"force-del",
				"skill",
				"claude-code",
				true,
				"converted-abc123",
				"target-xyz",
			),
		]);
		const targetStates = new Map([["/test/skill.md", makeTargetState("/test/skill.md", false)]]);
		const plan = reconcile(
			makeInput([source], registry, targetStates, [makeProvider()], { force: true }),
		);

		expect(plan.actions[0].action).toBe("install");
		expect(plan.actions[0].reasonCode).toBe("force-reinstall");
	});

	it("force + target exists + user-edited → reasonCode force-overwrite (not force-reinstall)", () => {
		const source = makeSourceItem("force-edit", "skill", "src", {
			"claude-code": "converted-abc123",
		});
		const registry = makeRegistry([
			makeRegistryEntry(
				"force-edit",
				"skill",
				"claude-code",
				true,
				"converted-abc123",
				"registered-target-xyz",
			),
		]);
		// Target exists but user has edited it (current checksum != registered)
		const targetStates = new Map([
			["/test/skill.md", makeTargetState("/test/skill.md", true, "user-edited-999")],
		]);
		const plan = reconcile(
			makeInput([source], registry, targetStates, [makeProvider()], { force: true }),
		);

		expect(plan.actions[0].action).toBe("install");
		// Must be force-overwrite (target exists + user edited), NOT force-reinstall (deleted)
		expect(plan.actions[0].reasonCode).toBe("force-overwrite");
		expect(plan.actions[0].reasonCopy).toContain("Force overwrite");
		expect(plan.actions[0].reasonCopy).not.toContain("deleted");
	});

	it("provider checksum unavailable (in registry) → reasonCode provider-checksum-unavailable", () => {
		const source = makeSourceItem("no-checksum", "skill", "src", {}); // Empty converted
		const registry = makeRegistry([makeRegistryEntry("no-checksum", "skill")]);
		const targetStates = new Map([
			["/test/skill.md", makeTargetState("/test/skill.md", true, "target-xyz")],
		]);
		const plan = reconcile(makeInput([source], registry, targetStates));

		expect(plan.actions[0].action).toBe("skip");
		expect(plan.actions[0].reasonCode).toBe("provider-checksum-unavailable");
	});

	it("orphan → reasonCode source-removed-orphan", () => {
		const registry = makeRegistry([makeRegistryEntry("orphan", "command")]);
		const plan = reconcile(makeInput([], registry, new Map(), [makeProvider()]));

		const del = plan.actions.find((a) => a.action === "delete");
		expect(del?.reasonCode).toBe("source-removed-orphan");
		expect(del?.reasonCopy).toBe(getReasonCopy("source-removed-orphan"));
	});

	it("registry upgrade (unknown checksums), target matches → reasonCode target-up-to-date-backfill", () => {
		const source = makeSourceItem("upgraded", "skill", "src", {
			"claude-code": "converted-abc123",
		});
		const registry = makeRegistry([
			{
				...makeRegistryEntry("upgraded", "skill", "claude-code", true, "unknown", "old-target"),
				sourceChecksum: "unknown",
			},
		]);
		const targetStates = new Map([
			["/test/skill.md", makeTargetState("/test/skill.md", true, "converted-abc123")],
		]);
		const plan = reconcile(makeInput([source], registry, targetStates));

		expect(plan.actions[0].action).toBe("skip");
		expect(plan.actions[0].reasonCode).toBe("target-up-to-date-backfill");
		expect(plan.actions[0].backfillRegistry).toBe(true);
	});

	it("registry upgrade, target missing → reasonCode registry-upgrade-reinstall", () => {
		const source = makeSourceItem("del-upgraded", "skill", "src", {
			"claude-code": "converted-abc123",
		});
		const registry = makeRegistry([
			{
				...makeRegistryEntry("del-upgraded", "skill"),
				sourceChecksum: "unknown",
			},
		]);
		const targetStates = new Map([["/test/skill.md", makeTargetState("/test/skill.md", false)]]);
		const plan = reconcile(makeInput([source], registry, targetStates));

		expect(plan.actions[0].action).toBe("install");
		expect(plan.actions[0].reasonCode).toBe("registry-upgrade-reinstall");
	});

	it("registry upgrade, target stale → reasonCode registry-upgrade-heal", () => {
		const source = makeSourceItem("stale-upgraded", "skill", "src", {
			"claude-code": "converted-correct",
		});
		const registry = makeRegistry([
			{
				...makeRegistryEntry(
					"stale-upgraded",
					"skill",
					"claude-code",
					true,
					"unknown",
					"faulty-target",
				),
				sourceChecksum: "unknown",
				targetChecksum: "faulty-target",
			},
		]);
		const targetStates = new Map([
			["/test/skill.md", makeTargetState("/test/skill.md", true, "faulty-target")],
		]);
		const plan = reconcile(makeInput([source], registry, targetStates));

		expect(plan.actions[0].action).toBe("update");
		expect(plan.actions[0].reasonCode).toBe("registry-upgrade-heal");
	});

	it("target state unknown, CK changed → reasonCode target-state-unknown-source-changed", () => {
		// No target state in index → unknown
		const source = makeSourceItem("unk-chg", "skill", "src", { "claude-code": "converted-NEW" });
		const registry = makeRegistry([
			makeRegistryEntry("unk-chg", "skill", "claude-code", true, "converted-OLD", "target-xyz"),
		]);
		// Provide a state that exists but has no currentChecksum, causing unknown
		const targetStates = new Map([
			["/test/skill.md", makeTargetState("/test/skill.md", true, undefined)],
		]);
		const plan = reconcile(makeInput([source], registry, targetStates));

		expect(plan.actions[0].action).toBe("conflict");
		expect(plan.actions[0].reasonCode).toBe("target-state-unknown-source-changed");
	});

	it("target state unknown, CK unchanged → reasonCode target-state-unknown", () => {
		const source = makeSourceItem("unk-unch", "skill", "src", {
			"claude-code": "converted-abc123",
		});
		const registry = makeRegistry([
			makeRegistryEntry("unk-unch", "skill", "claude-code", true, "converted-abc123", "target-xyz"),
		]);
		const targetStates = new Map([
			["/test/skill.md", makeTargetState("/test/skill.md", true, undefined)],
		]);
		const plan = reconcile(makeInput([source], registry, targetStates));

		expect(plan.actions[0].action).toBe("skip");
		expect(plan.actions[0].reasonCode).toBe("target-state-unknown");
	});
});

// ---------------------------------------------------------------------------
// isDirectoryItem flag
// ---------------------------------------------------------------------------

describe("reconciler - isDirectoryItem", () => {
	it("skill items get isDirectoryItem: true", () => {
		const plan = reconcile(makeInput([makeSourceItem("my-skill", "skill")], makeRegistry([])));
		expect(plan.actions[0].isDirectoryItem).toBe(true);
	});

	it("command items do NOT get isDirectoryItem", () => {
		const plan = reconcile(makeInput([makeSourceItem("my-command", "command")], makeRegistry([])));
		// Should be undefined or falsy — not true
		expect(plan.actions[0].isDirectoryItem).toBeFalsy();
	});

	it("agent items do NOT get isDirectoryItem", () => {
		const plan = reconcile(makeInput([makeSourceItem("my-agent", "agent")], makeRegistry([])));
		expect(plan.actions[0].isDirectoryItem).toBeFalsy();
	});
});

// ---------------------------------------------------------------------------
// banners[] always present
// ---------------------------------------------------------------------------

describe("reconciler - banners always present", () => {
	it("banners is an array even when empty (no typeDirectoryStates)", () => {
		const plan = reconcile(makeInput([makeSourceItem("x")], makeRegistry([])));
		expect(Array.isArray(plan.banners)).toBe(true);
	});

	it("banners is an array even when empty (dirStates present, no empty dir)", () => {
		const source = makeSourceItem("y");
		const dirState: TargetDirectoryState = {
			provider: "claude-code",
			type: "skill",
			global: true,
			path: "/home/.claude/skills",
			exists: true,
			isEmpty: false,
			fileCount: 5,
		};
		const plan = reconcile(
			makeInput([source], makeRegistry([]), new Map(), [makeProvider()], {
				typeDirectoryStates: [dirState],
			}),
		);
		expect(Array.isArray(plan.banners)).toBe(true);
		expect(plan.banners).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// Empty-dir override: flip user-deleted-respected → install
// ---------------------------------------------------------------------------

describe("reconciler - empty-dir override", () => {
	/** Build a deleted skill registry entry */
	function makeDeletedSkillInput(
		item: string,
		dirState: TargetDirectoryState,
		extra: Partial<ReconcileInput> = {},
	): ReconcileInput {
		const source = makeSourceItem(item, "skill", "src", { "claude-code": "converted-abc123" });
		const registry = makeRegistry([
			makeRegistryEntry(item, "skill", "claude-code", true, "converted-abc123", "target-xyz"),
		]);
		const targetStates = new Map([["/test/skill.md", makeTargetState("/test/skill.md", false)]]);
		return makeInput([source], registry, targetStates, [makeProvider()], {
			typeDirectoryStates: [dirState],
			...extra,
		});
	}

	it("flips user-deleted-respected → install when dir isEmpty", () => {
		const dirState = makeEmptyDirState();
		const plan = reconcile(makeDeletedSkillInput("del-skill", dirState));

		expect(plan.actions[0].action).toBe("install");
		expect(plan.actions[0].reasonCode).toBe("target-dir-empty-reinstall");
		expect(plan.actions[0].reason).toBe(getReasonCopy("target-dir-empty-reinstall"));
		expect(plan.summary.install).toBe(1);
	});

	it("emits empty-dir banner when dir isEmpty and flips occur", () => {
		const dirState = makeEmptyDirState();
		const plan = reconcile(makeDeletedSkillInput("del-skill", dirState));

		expect(plan.banners).toHaveLength(1);
		expect(plan.banners[0].kind).toBe("empty-dir");
		expect(plan.banners[0].provider).toBe("claude-code");
		expect(plan.banners[0].type).toBe("skill");
		expect(plan.banners[0].itemCount).toBe(1);
		expect(plan.banners[0].path).toBe("/home/user/.claude/skills");
		expect(plan.banners[0].message).toContain("reinstalled");
	});

	it("does NOT flip when dir is NOT empty", () => {
		const source = makeSourceItem("del-skill", "skill", "src", {
			"claude-code": "converted-abc123",
		});
		const registry = makeRegistry([
			makeRegistryEntry(
				"del-skill",
				"skill",
				"claude-code",
				true,
				"converted-abc123",
				"target-xyz",
			),
		]);
		const targetStates = new Map([["/test/skill.md", makeTargetState("/test/skill.md", false)]]);
		const dirState: TargetDirectoryState = {
			provider: "claude-code",
			type: "skill",
			global: true,
			path: "/home/.claude/skills",
			exists: true,
			isEmpty: false,
			fileCount: 3,
		};
		const plan = reconcile(
			makeInput([source], registry, targetStates, [makeProvider()], {
				typeDirectoryStates: [dirState],
			}),
		);

		expect(plan.actions[0].action).toBe("skip");
		expect(plan.actions[0].reasonCode).toBe("user-deleted-respected");
		expect(plan.banners).toHaveLength(0);
	});

	it("does NOT flip no-changes actions even when dir isEmpty", () => {
		// Target still exists (not deleted), so reasonCode is no-changes
		const source = makeSourceItem("stable", "skill", "src", { "claude-code": "converted-abc123" });
		const registry = makeRegistry([
			makeRegistryEntry("stable", "skill", "claude-code", true, "converted-abc123", "target-xyz"),
		]);
		const targetStates = new Map([
			["/test/skill.md", makeTargetState("/test/skill.md", true, "target-xyz")],
		]);
		const dirState = makeEmptyDirState();
		const plan = reconcile(
			makeInput([source], registry, targetStates, [makeProvider()], {
				typeDirectoryStates: [dirState],
			}),
		);

		expect(plan.actions[0].action).toBe("skip");
		expect(plan.actions[0].reasonCode).toBe("no-changes");
		expect(plan.banners).toHaveLength(0);
	});

	it("does NOT flip user-edits-preserved actions even when dir isEmpty", () => {
		const source = makeSourceItem("edited", "skill", "src", { "claude-code": "converted-abc123" });
		const registry = makeRegistry([
			makeRegistryEntry("edited", "skill", "claude-code", true, "converted-abc123", "target-xyz"),
		]);
		const targetStates = new Map([
			["/test/skill.md", makeTargetState("/test/skill.md", true, "target-user-edit")],
		]);
		const dirState = makeEmptyDirState();
		const plan = reconcile(
			makeInput([source], registry, targetStates, [makeProvider()], {
				typeDirectoryStates: [dirState],
			}),
		);

		expect(plan.actions[0].action).toBe("skip");
		expect(plan.actions[0].reasonCode).toBe("user-edits-preserved");
		expect(plan.banners).toHaveLength(0);
	});

	it("handles multiple deleted items in same empty dir → single banner, all flipped", () => {
		const items = ["skill-a", "skill-b", "skill-c"];
		const sources = items.map((item) =>
			makeSourceItem(item, "skill", "src", { "claude-code": "converted-abc123" }),
		);
		const registry = makeRegistry(
			items.map((item) =>
				makeRegistryEntry(
					item,
					"skill",
					"claude-code",
					true,
					"converted-abc123",
					"target-xyz",
					`/test/${item}.md`,
				),
			),
		);
		const targetStates = new Map(
			items.map((item) => [`/test/${item}.md`, makeTargetState(`/test/${item}.md`, false)]),
		);
		const dirState = makeEmptyDirState();
		const plan = reconcile(
			makeInput(sources, registry, targetStates, [makeProvider()], {
				typeDirectoryStates: [dirState],
			}),
		);

		const installs = plan.actions.filter((a) => a.action === "install");
		expect(installs).toHaveLength(3);
		expect(plan.banners).toHaveLength(1);
		expect(plan.banners[0].itemCount).toBe(3);
	});

	it("mixed state: some deleted, some present — only deleted items flip", () => {
		const sources = [
			makeSourceItem("del-1", "skill", "src", { "claude-code": "converted-abc123" }),
			makeSourceItem("present-1", "skill", "src2", { "claude-code": "converted-present" }),
		];
		const registry = makeRegistry([
			makeRegistryEntry(
				"del-1",
				"skill",
				"claude-code",
				true,
				"converted-abc123",
				"target-xyz",
				"/test/del-1.md",
			),
			makeRegistryEntry(
				"present-1",
				"skill",
				"claude-code",
				true,
				"converted-present",
				"target-present",
				"/test/present-1.md",
			),
		]);
		const targetStates = new Map([
			["/test/del-1.md", makeTargetState("/test/del-1.md", false)],
			["/test/present-1.md", makeTargetState("/test/present-1.md", true, "target-present")],
		]);
		const dirState = makeEmptyDirState(); // dir reports empty from external scan

		const plan = reconcile(
			makeInput(sources, registry, targetStates, [makeProvider()], {
				typeDirectoryStates: [dirState],
			}),
		);

		const del1 = plan.actions.find((a) => a.item === "del-1");
		const present1 = plan.actions.find((a) => a.item === "present-1");

		// Only del-1 gets flipped (it was user-deleted-respected)
		expect(del1?.action).toBe("install");
		expect(del1?.reasonCode).toBe("target-dir-empty-reinstall");

		// present-1 was no-changes, must NOT be flipped
		expect(present1?.action).toBe("skip");
		expect(present1?.reasonCode).toBe("no-changes");

		// Banner counts only the flipped item
		expect(plan.banners).toHaveLength(1);
		expect(plan.banners[0].itemCount).toBe(1);
	});

	it("respectDeletions: true skips flip, emits empty-dir-respected banner", () => {
		const dirState = makeEmptyDirState();
		const plan = reconcile(
			makeDeletedSkillInput("del-respected", dirState, { respectDeletions: true }),
		);

		// Action must NOT be flipped
		expect(plan.actions[0].action).toBe("skip");
		expect(plan.actions[0].reasonCode).toBe("user-deleted-respected");

		// Banner emitted as "respected" variant
		expect(plan.banners).toHaveLength(1);
		expect(plan.banners[0].kind).toBe("empty-dir-respected");
		expect(plan.banners[0].itemCount).toBe(1);
		expect(plan.banners[0].message).toContain("respecting");
	});

	it("no typeDirectoryStates provided → no empty-dir override (back-compat)", () => {
		const source = makeSourceItem("del-compat", "skill", "src", {
			"claude-code": "converted-abc123",
		});
		const registry = makeRegistry([
			makeRegistryEntry(
				"del-compat",
				"skill",
				"claude-code",
				true,
				"converted-abc123",
				"target-xyz",
			),
		]);
		const targetStates = new Map([["/test/skill.md", makeTargetState("/test/skill.md", false)]]);

		// No typeDirectoryStates in input
		const plan = reconcile(makeInput([source], registry, targetStates));

		expect(plan.actions[0].action).toBe("skip");
		expect(plan.actions[0].reasonCode).toBe("user-deleted-respected");
		expect(plan.banners).toHaveLength(0);
	});

	it("dirState for wrong provider does not affect actions", () => {
		const source = makeSourceItem("del-wrong", "skill", "src", {
			"claude-code": "converted-abc123",
		});
		const registry = makeRegistry([
			makeRegistryEntry(
				"del-wrong",
				"skill",
				"claude-code",
				true,
				"converted-abc123",
				"target-xyz",
			),
		]);
		const targetStates = new Map([["/test/skill.md", makeTargetState("/test/skill.md", false)]]);

		// dirState for a different provider
		const dirState: TargetDirectoryState = {
			...makeEmptyDirState(),
			provider: "cursor", // Wrong provider — should NOT affect claude-code action
		};
		const plan = reconcile(
			makeInput([source], registry, targetStates, [makeProvider()], {
				typeDirectoryStates: [dirState],
			}),
		);

		expect(plan.actions[0].action).toBe("skip");
		expect(plan.actions[0].reasonCode).toBe("user-deleted-respected");
		expect(plan.banners).toHaveLength(0);
	});
});
