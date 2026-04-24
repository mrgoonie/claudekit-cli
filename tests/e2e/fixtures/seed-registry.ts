/**
 * Registry seed builders for E2E specs.
 *
 * Each builder returns a PortableRegistryV3 (or null for fresh-state
 * scenarios) that can be passed directly to makeTmpHome({ registry }).
 *
 * Checksums use obvious sentinel values ("sha256-source-xxx",
 * "sha256-target-xxx") — they are recognised by the reconciler as real
 * checksums (non-"unknown"), which is all tests need. Never put real
 * file content here.
 */

import type { PortableInstallationV3, PortableRegistryV3 } from "./tmp-home.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function now(): string {
	return new Date().toISOString();
}

function installation(
	overrides: Partial<PortableInstallationV3> &
		Pick<PortableInstallationV3, "item" | "type" | "provider" | "path" | "sourcePath">,
): PortableInstallationV3 {
	return {
		global: false,
		installedAt: now(),
		cliVersion: "3.41.4-dev.48",
		sourceChecksum: `sha256-source-${overrides.item}`,
		targetChecksum: `sha256-target-${overrides.item}`,
		installSource: "kit",
		...overrides,
	};
}

// ─── Scenario A — empty-dir reinstall ────────────────────────────────────────

/**
 * Registry for Scenario A:
 * - 3 codex hooks were previously installed
 * - The target ~/.codex/hooks/ dir will be missing/empty (seeded separately)
 * - Reconciler should detect empty-dir → emit banner → route items to Install
 */
export function buildScenarioARegistry(tmpHome: string): PortableRegistryV3 {
	return {
		version: "3.0",
		installations: [
			installation({
				item: "pre-commit",
				type: "hooks",
				provider: "codex",
				global: false,
				path: `${tmpHome}/.codex/hooks/pre-commit`,
				sourcePath: ".codex/hooks/pre-commit",
			}),
			installation({
				item: "post-commit",
				type: "hooks",
				provider: "codex",
				global: false,
				path: `${tmpHome}/.codex/hooks/post-commit`,
				sourcePath: ".codex/hooks/post-commit",
			}),
			installation({
				item: "pre-push",
				type: "hooks",
				provider: "codex",
				global: false,
				path: `${tmpHome}/.codex/hooks/pre-push`,
				sourcePath: ".codex/hooks/pre-push",
			}),
		],
		lastReconciled: now(),
	};
}

// ─── Scenario B — 4-tab routing ───────────────────────────────────────────────

/**
 * Registry for Scenario B:
 * - 1 agent: present in source + registry → may route to Install/Skip/Update depending on checksums
 * - 1 agent (orphan): in registry but source removed → Delete
 * - 1 hook (user-edited): target checksum differs from both registered target + source → Skip (user-edits-preserved)
 * - 1 hook (unchanged): matches both source and target checksums → Skip (no-changes)
 * - 1 command (source changed): source checksum differs from registered source, target unchanged → Update
 *
 * Note: targetChecksum = "sha256-target-xxx" matches what will be on disk after seeding.
 *       The "user-edited" hook has a different targetChecksum to simulate user edits.
 */
export function buildScenarioBRegistry(tmpHome: string): PortableRegistryV3 {
	return {
		version: "3.0",
		installations: [
			// Active agent — still in source, target exists on disk → Skip (no-changes)
			installation({
				item: "code-reviewer",
				type: "agent",
				provider: "claude",
				global: false,
				path: `${tmpHome}/.claude/agents/code-reviewer.md`,
				sourcePath: ".claude/agents/code-reviewer.md",
				sourceChecksum: "sha256-source-code-reviewer",
				targetChecksum: "sha256-target-code-reviewer",
			}),
			// Orphan agent — in registry but source no longer has it → Delete
			installation({
				item: "deprecated-agent",
				type: "agent",
				provider: "claude",
				global: false,
				path: `${tmpHome}/.claude/agents/deprecated-agent.md`,
				sourcePath: ".claude/agents/deprecated-agent.md",
				sourceChecksum: "sha256-source-deprecated-agent",
				targetChecksum: "sha256-target-deprecated-agent",
			}),
			// User-edited hook — target checksum differs from registered → Skip (user-edits-preserved)
			installation({
				item: "pre-commit",
				type: "hooks",
				provider: "codex",
				global: false,
				path: `${tmpHome}/.codex/hooks/pre-commit`,
				sourcePath: ".codex/hooks/pre-commit",
				sourceChecksum: "sha256-source-pre-commit",
				// Registered target checksum doesn't match what's on disk → user edited
				targetChecksum: "sha256-target-pre-commit-original",
			}),
			// Unchanged hook — matches both → Skip (no-changes)
			installation({
				item: "post-commit",
				type: "hooks",
				provider: "codex",
				global: false,
				path: `${tmpHome}/.codex/hooks/post-commit`,
				sourcePath: ".codex/hooks/post-commit",
				sourceChecksum: "sha256-source-post-commit",
				targetChecksum: "sha256-target-post-commit",
			}),
			// Command with source changed — registered source checksum differs from current source → Update
			installation({
				item: "build",
				type: "command",
				provider: "claude",
				global: false,
				path: `${tmpHome}/.claude/commands/build.md`,
				sourcePath: ".claude/commands/build.md",
				// Registered source checksum differs from current → CK updated this
				sourceChecksum: "sha256-source-build-old",
				targetChecksum: "sha256-target-build",
			}),
		],
		lastReconciled: now(),
	};
}

// ─── Scenario C — fresh install mode ─────────────────────────────────────────

/**
 * Scenario C: No registry at all → server returns suggestedMode="install".
 * Return null so makeTmpHome skips writing the registry file.
 */
export function buildScenarioCRegistry(): null {
	return null;
}
