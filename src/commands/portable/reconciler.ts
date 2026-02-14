/**
 * Pure reconciler module — zero I/O, fully testable
 * Determines what actions to take for each (item, provider) combination
 */
import { getApplicableEntries } from "./portable-manifest.js";
import type { PortableInstallationV3 } from "./portable-registry.js";
import type {
	ReconcileAction,
	ReconcileInput,
	ReconcilePlan,
	ReconcileProviderInput,
	SourceItemState,
} from "./reconcile-types.js";

/**
 * Main reconciliation entry point
 * Takes current state → returns plan with actions
 */
export function reconcile(input: ReconcileInput): ReconcilePlan {
	const actions: ReconcileAction[] = [];

	// Step 1: Process renames from manifest (Phase 4 provides data)
	const renames = input.manifest ? detectRenames(input) : [];
	const renamedFromKeys = new Set<string>();
	for (const rename of renames) {
		actions.push(rename.deleteAction);
		renamedFromKeys.add(`${rename.deleteAction.item}:${rename.deleteAction.type}`);
	}

	// Step 2: Process path migrations from manifest (Phase 4)
	const pathMigrations = input.manifest ? detectPathMigrations(input) : [];
	for (const migration of pathMigrations) {
		actions.push(migration.deleteAction);
	}

	// Step 2.5: Process section renames (Phase 5 — stub for now)
	const sectionRenames = input.manifest ? detectSectionRenames(input) : [];
	actions.push(...sectionRenames);

	// Step 3: For each source item × provider, determine action
	for (const sourceItem of input.sourceItems) {
		for (const providerConfig of input.providerConfigs) {
			const action = determineAction(sourceItem, providerConfig, input);
			actions.push(action);
		}
	}

	// Step 4: Detect orphaned registry entries (in registry but not in source)
	const orphanActions = detectOrphans(input, renamedFromKeys);
	actions.push(...orphanActions);

	return buildPlan(actions);
}

/**
 * Core decision matrix for a single (item, provider) combination
 */
function determineAction(
	source: SourceItemState,
	providerConfig: ReconcileProviderInput,
	input: ReconcileInput,
): ReconcileAction {
	const registryEntry = findRegistryEntry(source, providerConfig, input.registry);

	// Common fields for all actions
	const common = {
		item: source.item,
		type: source.type,
		provider: providerConfig.provider,
		global: providerConfig.global,
		targetPath: "", // Caller fills this in during execution
	};

	// Get converted checksum for this provider
	const convertedChecksum = source.convertedChecksums[providerConfig.provider];
	if (!convertedChecksum) {
		// Provider not in convertedChecksums → caller hasn't computed conversion yet
		// This means item exists but not for this provider → new install
		return {
			...common,
			action: "install",
			reason: "New provider for existing item",
			sourceChecksum: source.sourceChecksum,
		};
	}

	// Case A: Not in registry → NEW install
	if (!registryEntry) {
		// Check if item exists in registry for OTHER providers
		const itemExistsElsewhere = input.registry.installations.some(
			(i) => i.item === source.item && i.type === source.type,
		);
		const reason = itemExistsElsewhere
			? "New provider for existing item"
			: "New item, not previously installed";

		return {
			...common,
			action: "install",
			reason,
			sourceChecksum: convertedChecksum,
		};
	}

	// Update targetPath from registry
	common.targetPath = registryEntry.path;

	// Case B: In registry with "unknown" checksums (v2→v3 migration)
	// First run after upgrade → skip and populate checksums without writing
	if (registryEntry.sourceChecksum === "unknown") {
		return {
			...common,
			action: "skip",
			reason: "First run after registry upgrade — populating checksums (no writes)",
			sourceChecksum: convertedChecksum,
			currentTargetChecksum: registryEntry.targetChecksum,
		};
	}

	// Case C: Compute deltas
	const sourceChanged = convertedChecksum !== registryEntry.sourceChecksum;
	const targetState = input.targetStates.get(registryEntry.path);

	// Target file deleted by user
	if (targetState && !targetState.exists) {
		return {
			...common,
			action: sourceChanged ? "install" : "skip",
			reason: sourceChanged
				? "Target was deleted, CK has updates — reinstalling"
				: "Target was deleted by user, CK unchanged — respecting deletion",
			sourceChecksum: convertedChecksum,
			registeredSourceChecksum: registryEntry.sourceChecksum,
		};
	}

	const targetChanged = targetState?.currentChecksum !== registryEntry.targetChecksum;

	// Decision matrix
	if (!sourceChanged && !targetChanged) {
		return {
			...common,
			action: "skip",
			reason: "No changes",
			sourceChecksum: convertedChecksum,
			currentTargetChecksum: targetState?.currentChecksum,
		};
	}

	if (!sourceChanged && targetChanged) {
		return {
			...common,
			action: "skip",
			reason: "User edited, CK unchanged — preserving edits",
			sourceChecksum: convertedChecksum,
			registeredSourceChecksum: registryEntry.sourceChecksum,
			currentTargetChecksum: targetState?.currentChecksum,
			registeredTargetChecksum: registryEntry.targetChecksum,
		};
	}

	if (sourceChanged && !targetChanged) {
		return {
			...common,
			action: "update",
			reason: "CK updated, no user edits — safe overwrite",
			sourceChecksum: convertedChecksum,
			registeredSourceChecksum: registryEntry.sourceChecksum,
			currentTargetChecksum: targetState?.currentChecksum,
			registeredTargetChecksum: registryEntry.targetChecksum,
		};
	}

	// Both changed → CONFLICT
	return {
		...common,
		action: "conflict",
		reason: "Both CK and user modified this item",
		sourceChecksum: convertedChecksum,
		registeredSourceChecksum: registryEntry.sourceChecksum,
		currentTargetChecksum: targetState?.currentChecksum,
		registeredTargetChecksum: registryEntry.targetChecksum,
	};
}

/**
 * Find registry entry for a source item + provider combination
 */
function findRegistryEntry(
	source: SourceItemState,
	providerConfig: ReconcileProviderInput,
	registry: { installations: PortableInstallationV3[] },
): PortableInstallationV3 | null {
	return (
		registry.installations.find(
			(i) =>
				i.item === source.item &&
				i.type === source.type &&
				i.provider === providerConfig.provider &&
				i.global === providerConfig.global,
		) || null
	);
}

/**
 * Detect orphaned registry entries (in registry but not in source)
 * Excludes renamed items, manually-installed items, and skills
 */
function detectOrphans(input: ReconcileInput, renamedFromKeys: Set<string>): ReconcileAction[] {
	const actions: ReconcileAction[] = [];
	const sourceItemKeys = new Set(input.sourceItems.map((s) => `${s.item}:${s.type}`));

	for (const entry of input.registry.installations) {
		const key = `${entry.item}:${entry.type}`;

		// Skip items already handled by rename detection
		if (renamedFromKeys.has(key)) continue;

		// Skip manually-installed items (not from CK kit source)
		if (entry.installSource === "manual") continue;

		// Skip skills — they are directory-based and not tracked through sourceItems
		// Skills are discovered via filesystem scan, not manifest, so they won't appear in sourceItems
		if (entry.type === "skill") continue;

		if (!sourceItemKeys.has(key)) {
			actions.push({
				action: "delete",
				item: entry.item,
				type: entry.type,
				provider: entry.provider,
				global: entry.global,
				targetPath: entry.path,
				reason: "Item no longer in CK source — orphaned",
			});
		}
	}

	return actions;
}

/**
 * Detect renames from manifest
 * Returns delete actions for old paths + metadata for new installs
 */
function detectRenames(
	input: ReconcileInput,
): Array<{ deleteAction: ReconcileAction; newItem: string }> {
	if (!input.manifest) return [];

	const applicable = getApplicableEntries(
		input.manifest.renames,
		input.registry.appliedManifestVersion,
		input.manifest.cliVersion,
	);

	const actions: Array<{ deleteAction: ReconcileAction; newItem: string }> = [];

	for (const rename of applicable) {
		// Path traversal validation (defense in depth — schema already rejects)
		if (rename.from.includes("..") || rename.to.includes("..")) {
			console.warn(`[!] Skipping suspicious manifest rename: ${rename.from} -> ${rename.to}`);
			continue;
		}

		// Find registry entries with old source path
		const oldEntries = input.registry.installations.filter((e) => e.sourcePath === rename.from);

		for (const oldEntry of oldEntries) {
			actions.push({
				deleteAction: {
					action: "delete",
					item: oldEntry.item,
					type: oldEntry.type,
					provider: oldEntry.provider,
					global: oldEntry.global,
					targetPath: oldEntry.path,
					reason: `Renamed: ${rename.from} -> ${rename.to}`,
					previousItem: oldEntry.item,
				},
				newItem: oldEntry.item, // Item name unchanged, only source path changed
			});
		}
	}

	return actions;
}

/**
 * Detect provider path migrations from manifest
 * Returns delete actions for old paths
 */
function detectPathMigrations(input: ReconcileInput): Array<{ deleteAction: ReconcileAction }> {
	if (!input.manifest) return [];

	const applicable = getApplicableEntries(
		input.manifest.providerPathMigrations,
		input.registry.appliedManifestVersion,
		input.manifest.cliVersion,
	);

	const actions: Array<{ deleteAction: ReconcileAction }> = [];

	for (const migration of applicable) {
		// Find registry entries affected by this path migration
		// Use includes() — from always ends with "/" which prevents substring false matches
		// (e.g., ".codex/skills/" won't match ".codex/skills-backup/")
		const affectedEntries = input.registry.installations.filter(
			(e) =>
				e.provider === migration.provider &&
				e.type === migration.type &&
				e.path.includes(migration.from),
		);

		for (const entry of affectedEntries) {
			actions.push({
				deleteAction: {
					action: "delete",
					item: entry.item,
					type: entry.type,
					provider: entry.provider,
					global: entry.global,
					targetPath: entry.path,
					reason: `Provider path migrated: ${migration.from} -> ${migration.to}`,
					previousPath: entry.path,
				},
			});
		}
	}

	return actions;
}

/**
 * Detect section renames from manifest (for merge targets)
 * Currently returns empty — full implementation in Phase 5 (merge support)
 */
function detectSectionRenames(_input: ReconcileInput): ReconcileAction[] {
	// Phase 5 will implement merge target section renaming
	// For now, return empty — no section-based actions
	return [];
}

/**
 * Build plan summary from actions
 */
function buildPlan(actions: ReconcileAction[]): ReconcilePlan {
	const summary = { install: 0, update: 0, skip: 0, conflict: 0, delete: 0 };
	for (const action of actions) {
		summary[action.action]++;
	}

	return {
		actions,
		summary,
		hasConflicts: summary.conflict > 0,
	};
}
