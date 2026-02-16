/**
 * Pure reconciler module — zero I/O, fully testable
 * Determines what actions to take for each (item, provider) combination
 */
import path from "node:path";
import { getApplicableEntries } from "./portable-manifest.js";
import type { PortableInstallationV3 } from "./portable-registry.js";
import { UNKNOWN_CHECKSUM, isUnknownChecksum, normalizeChecksum } from "./reconcile-types.js";
import type {
	ReconcileAction,
	ReconcileInput,
	ReconcilePlan,
	ReconcileProviderInput,
	SourceItemState,
	TargetFileState,
} from "./reconcile-types.js";

type TargetChangeState = "unchanged" | "changed" | "deleted" | "unknown";

function normalizePortablePath(value: string): string {
	const asPosix = value.replace(/\\/g, "/");
	const normalized = path.posix.normalize(asPosix);
	if (normalized === ".") return "";
	return normalized.replace(/^\.\/+/, "");
}

function isAbsoluteLike(value: string): boolean {
	return path.isAbsolute(value) || /^[a-zA-Z]:[\\/]/.test(value) || /^\\\\/.test(value);
}

function hasDotDotSegment(value: string): boolean {
	return value
		.replace(/\\/g, "/")
		.split("/")
		.some((segment) => segment === "..");
}

function toPathSegments(value: string): string[] {
	const normalized = normalizePortablePath(value).replace(/^\/+/, "").replace(/\/+$/, "");
	if (!normalized) return [];
	return normalized.split("/").filter(Boolean);
}

function pathContainsSegments(targetPath: string, fragmentPath: string): boolean {
	const targetSegments = toPathSegments(targetPath);
	const fragmentSegments = toPathSegments(fragmentPath);
	if (fragmentSegments.length === 0) return false;
	if (fragmentSegments.length > targetSegments.length) return false;

	for (let i = 0; i <= targetSegments.length - fragmentSegments.length; i++) {
		let allMatch = true;
		for (let j = 0; j < fragmentSegments.length; j++) {
			if (targetSegments[i + j] !== fragmentSegments[j]) {
				allMatch = false;
				break;
			}
		}
		if (allMatch) return true;
	}
	return false;
}

function makeProviderConfigKey(provider: string, global: boolean): string {
	return JSON.stringify([provider, global]);
}

function makeItemTypeKey(item: string, type: SourceItemState["type"]): string {
	return JSON.stringify([item, type]);
}

function makeRegistryIdentityKey(entry: {
	item: string;
	type: ReconcileAction["type"];
	provider: string;
	global: boolean;
}): string {
	return JSON.stringify([entry.item, entry.type, entry.provider, entry.global]);
}

function dedupeProviderConfigs(
	providerConfigs: ReconcileProviderInput[],
): ReconcileProviderInput[] {
	const seen = new Set<string>();
	const unique: ReconcileProviderInput[] = [];

	for (const config of providerConfigs) {
		const key = makeProviderConfigKey(config.provider, config.global);
		if (seen.has(key)) continue;
		seen.add(key);
		unique.push(config);
	}

	return unique;
}

function buildTargetStateIndex(
	targetStates: Map<string, TargetFileState>,
): Map<string, TargetFileState> {
	const index = new Map<string, TargetFileState>();

	for (const [mapPath, state] of targetStates) {
		const normalizedMapPath = normalizePortablePath(mapPath);
		if (normalizedMapPath && !index.has(normalizedMapPath)) {
			index.set(normalizedMapPath, state);
		}

		const normalizedStatePath = normalizePortablePath(state.path);
		if (normalizedStatePath && !index.has(normalizedStatePath)) {
			index.set(normalizedStatePath, state);
		}
	}

	return index;
}

function lookupTargetState(
	targetStateIndex: Map<string, TargetFileState>,
	pathValue: string,
): TargetFileState | undefined {
	return targetStateIndex.get(normalizePortablePath(pathValue));
}

function getTargetChangeState(
	targetState: TargetFileState | undefined,
	registeredTargetChecksum: string,
): TargetChangeState {
	if (!targetState) return "unknown";
	if (!targetState.exists) return "deleted";

	const currentTargetChecksum = normalizeChecksum(targetState.currentChecksum);
	if (isUnknownChecksum(currentTargetChecksum) || isUnknownChecksum(registeredTargetChecksum)) {
		return "unknown";
	}

	return currentTargetChecksum === registeredTargetChecksum ? "unchanged" : "changed";
}

function dedupeActions(actions: ReconcileAction[]): ReconcileAction[] {
	const seen = new Set<string>();
	const deduped: ReconcileAction[] = [];

	for (const action of actions) {
		const key = JSON.stringify([
			action.action,
			action.item,
			action.type,
			action.provider,
			action.global,
			normalizePortablePath(action.targetPath),
		]);
		if (seen.has(key)) continue;
		seen.add(key);
		deduped.push(action);
	}

	return deduped;
}

function suppressOverlappingActions(actions: ReconcileAction[]): ReconcileAction[] {
	const byIdentity = new Map<string, ReconcileAction[]>();
	for (const action of actions) {
		const key = makeRegistryIdentityKey(action);
		const list = byIdentity.get(key) ?? [];
		list.push(action);
		byIdentity.set(key, list);
	}

	const filtered: ReconcileAction[] = [];
	for (const action of actions) {
		const key = makeRegistryIdentityKey(action);
		const actionsForKey = byIdentity.get(key) ?? [];
		const hasDelete = actionsForKey.some((a) => a.action === "delete");
		if (!hasDelete) {
			filtered.push(action);
			continue;
		}

		if (action.action === "delete" || action.action === "install") {
			filtered.push(action);
		}
	}

	return filtered;
}

/**
 * Main reconciliation entry point
 * Takes current state → returns plan with actions
 */
export function reconcile(input: ReconcileInput): ReconcilePlan {
	const actions: ReconcileAction[] = [];
	const targetStateIndex = buildTargetStateIndex(input.targetStates);
	const uniqueProviderConfigs = dedupeProviderConfigs(input.providerConfigs);
	const deletedIdentityKeys = new Set<string>();

	// Step 1: Process renames from manifest (Phase 4 provides data)
	const renames = input.manifest ? detectRenames(input) : [];
	const renamedFromKeys = new Set<string>();
	for (const rename of renames) {
		actions.push(rename.deleteAction);
		const key = makeRegistryIdentityKey(rename.deleteAction);
		renamedFromKeys.add(key);
		deletedIdentityKeys.add(key);
	}

	// Step 2: Process path migrations from manifest (Phase 4)
	const pathMigrations = input.manifest ? detectPathMigrations(input) : [];
	for (const migration of pathMigrations) {
		actions.push(migration.deleteAction);
		deletedIdentityKeys.add(makeRegistryIdentityKey(migration.deleteAction));
	}

	// Step 2.5: Process section renames (Phase 5 — stub for now)
	const sectionRenames = input.manifest ? detectSectionRenames(input) : [];
	actions.push(...sectionRenames);

	// Step 3: For each source item × provider, determine action
	for (const sourceItem of input.sourceItems) {
		for (const providerConfig of uniqueProviderConfigs) {
			const action = determineAction(
				sourceItem,
				providerConfig,
				input,
				targetStateIndex,
				deletedIdentityKeys,
			);
			actions.push(action);
		}
	}

	// Step 4: Detect orphaned registry entries (in registry but not in source)
	const orphanActions = detectOrphans(input, renamedFromKeys);
	actions.push(...orphanActions);

	const normalizedActions = suppressOverlappingActions(dedupeActions(actions));
	return buildPlan(normalizedActions);
}

/**
 * Core decision matrix for a single (item, provider) combination
 */
function determineAction(
	source: SourceItemState,
	providerConfig: ReconcileProviderInput,
	input: ReconcileInput,
	targetStateIndex: Map<string, TargetFileState>,
	deletedIdentityKeys: Set<string>,
): ReconcileAction {
	let registryEntry = findRegistryEntry(source, providerConfig, input.registry);
	const identityKey = makeRegistryIdentityKey({
		item: source.item,
		type: source.type,
		provider: providerConfig.provider,
		global: providerConfig.global,
	});
	if (registryEntry && deletedIdentityKeys.has(identityKey)) {
		// A rename/path-migration already scheduled cleanup for this identity;
		// treat it as a fresh install target for this run.
		registryEntry = null;
	}

	// Common fields for all actions
	const common = {
		item: source.item,
		type: source.type,
		provider: providerConfig.provider,
		global: providerConfig.global,
		targetPath: "", // Caller fills this in during execution
	};

	// Get converted checksum for this provider
	const convertedChecksumRaw = source.convertedChecksums[providerConfig.provider];
	const convertedChecksum = normalizeChecksum(convertedChecksumRaw);

	if (!convertedChecksumRaw || isUnknownChecksum(convertedChecksumRaw)) {
		// Missing provider checksum should never force a destructive decision.
		if (registryEntry) {
			common.targetPath = registryEntry.path;
			return {
				...common,
				action: "skip",
				reason: "Provider checksum unavailable — cannot verify safely",
				sourceChecksum: UNKNOWN_CHECKSUM,
				registeredSourceChecksum: normalizeChecksum(registryEntry.sourceChecksum),
				registeredTargetChecksum: normalizeChecksum(registryEntry.targetChecksum),
			};
		}

		const itemExistsElsewhere = input.registry.installations.some(
			(i) => i.item === source.item && i.type === source.type,
		);
		return {
			...common,
			action: "install",
			reason: itemExistsElsewhere
				? "New provider for existing item"
				: "New item, not previously installed",
			sourceChecksum: UNKNOWN_CHECKSUM,
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
	const registeredSourceChecksum = normalizeChecksum(registryEntry.sourceChecksum);
	const registeredTargetChecksum = normalizeChecksum(registryEntry.targetChecksum);

	// Case B: In registry with "unknown" checksums (v2→v3 migration)
	// First run after upgrade → skip and populate checksums without writing
	if (isUnknownChecksum(registeredSourceChecksum)) {
		return {
			...common,
			action: "skip",
			reason: "First run after registry upgrade — populating checksums (no writes)",
			sourceChecksum: convertedChecksum,
			currentTargetChecksum: registeredTargetChecksum,
		};
	}

	// Case C: Compute deltas
	const sourceChanged = convertedChecksum !== registeredSourceChecksum;
	const targetState = lookupTargetState(targetStateIndex, registryEntry.path);
	const targetChangeState = getTargetChangeState(targetState, registeredTargetChecksum);

	// Target file deleted by user
	if (targetChangeState === "deleted") {
		return {
			...common,
			action: sourceChanged ? "install" : "skip",
			reason: sourceChanged
				? "Target was deleted, CK has updates — reinstalling"
				: "Target was deleted by user, CK unchanged — respecting deletion",
			sourceChecksum: convertedChecksum,
			registeredSourceChecksum,
		};
	}

	if (targetChangeState === "unknown") {
		return {
			...common,
			action: sourceChanged ? "conflict" : "skip",
			reason: sourceChanged
				? "Target state unavailable while CK changed — manual review required"
				: "Target state unavailable, CK unchanged — preserving target",
			sourceChecksum: convertedChecksum,
			registeredSourceChecksum,
			currentTargetChecksum: normalizeChecksum(targetState?.currentChecksum),
			registeredTargetChecksum,
		};
	}

	const targetChanged = targetChangeState === "changed";

	// Decision matrix
	if (!sourceChanged && !targetChanged) {
		return {
			...common,
			action: "skip",
			reason: "No changes",
			sourceChecksum: convertedChecksum,
			currentTargetChecksum: normalizeChecksum(targetState?.currentChecksum),
		};
	}

	if (!sourceChanged && targetChanged) {
		return {
			...common,
			action: "skip",
			reason: "User edited, CK unchanged — preserving edits",
			sourceChecksum: convertedChecksum,
			registeredSourceChecksum,
			currentTargetChecksum: normalizeChecksum(targetState?.currentChecksum),
			registeredTargetChecksum,
		};
	}

	if (sourceChanged && !targetChanged) {
		return {
			...common,
			action: "update",
			reason: "CK updated, no user edits — safe overwrite",
			sourceChecksum: convertedChecksum,
			registeredSourceChecksum,
			currentTargetChecksum: normalizeChecksum(targetState?.currentChecksum),
			registeredTargetChecksum,
		};
	}

	// Both changed → CONFLICT
	return {
		...common,
		action: "conflict",
		reason: "Both CK and user modified this item",
		sourceChecksum: convertedChecksum,
		registeredSourceChecksum,
		currentTargetChecksum: normalizeChecksum(targetState?.currentChecksum),
		registeredTargetChecksum,
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
	const exactMatch =
		registry.installations.find(
			(i) =>
				i.item === source.item &&
				i.type === source.type &&
				i.provider === providerConfig.provider &&
				i.global === providerConfig.global,
		) || null;
	if (exactMatch) return exactMatch;

	// Config is a singleton per provider+scope target file.
	// Fallback match avoids destructive install+delete when item naming changes.
	if (source.type === "config") {
		return (
			registry.installations.find(
				(i) =>
					i.type === "config" &&
					i.provider === providerConfig.provider &&
					i.global === providerConfig.global,
			) || null
		);
	}

	return null;
}

/**
 * Detect orphaned registry entries (in registry but not in source)
 * Excludes renamed items, manually-installed items, and skills
 */
function detectOrphans(input: ReconcileInput, renamedFromKeys: Set<string>): ReconcileAction[] {
	const actions: ReconcileAction[] = [];
	const sourceItemKeys = new Set(input.sourceItems.map((s) => makeItemTypeKey(s.item, s.type)));
	const activeProviderKeys = new Set(
		input.providerConfigs.map((provider) =>
			makeProviderConfigKey(provider.provider, provider.global),
		),
	);
	const hasConfigSource = input.sourceItems.some((source) => source.type === "config");

	for (const entry of input.registry.installations) {
		const key = makeRegistryIdentityKey(entry);
		const sourceItemKey = makeItemTypeKey(entry.item, entry.type);
		const providerKey = makeProviderConfigKey(entry.provider, entry.global);

		// Only consider registry entries in the current execution scope.
		if (!activeProviderKeys.has(providerKey)) continue;

		// Skip items already handled by rename detection
		if (renamedFromKeys.has(key)) continue;

		// Skip manually-installed items (not from CK kit source)
		if (entry.installSource === "manual") continue;

		// Skip skills — they are directory-based and not tracked through sourceItems
		// Skills are discovered via filesystem scan, not manifest, so they won't appear in sourceItems
		if (entry.type === "skill") continue;

		// Config is a singleton per provider/scope; preserve existing config entries
		// when any config source is present for this run.
		if (entry.type === "config" && hasConfigSource) continue;

		if (!sourceItemKeys.has(sourceItemKey)) {
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
		if (
			hasDotDotSegment(rename.from) ||
			hasDotDotSegment(rename.to) ||
			isAbsoluteLike(rename.from) ||
			isAbsoluteLike(rename.to)
		) {
			console.warn(`[!] Skipping suspicious manifest rename: ${rename.from} -> ${rename.to}`);
			continue;
		}

		const normalizedFrom = normalizePortablePath(rename.from);

		// Find registry entries with old source path
		const oldEntries = input.registry.installations.filter(
			(e) => normalizePortablePath(e.sourcePath) === normalizedFrom,
		);

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
		// Normalize separators/redundant segments and match by path segments,
		// not plain substring.
		const affectedEntries = input.registry.installations.filter(
			(e) =>
				e.provider === migration.provider &&
				e.type === migration.type &&
				pathContainsSegments(e.path, migration.from),
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
