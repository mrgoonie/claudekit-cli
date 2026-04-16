/**
 * Plans Registry
 * Maintains global plans registry at ~/.claude/plans-registries/<hash>.json as an index of all plans with metadata.
 * Auto-updates on create, check, uncheck, add-phase operations.
 * Auto-migrates from legacy project-local .claude/plans-registry.json on first read.
 */
import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, parse, relative, resolve } from "node:path";
import { PathResolver } from "@/shared/path-resolver.js";
import {
	type PlanSource,
	type PlansRegistry,
	type PlansRegistryEntry,
	PlansRegistrySchema,
} from "./plan-types.js";

/** Old project-local registry path — used only for migration. path.join() normalizes separators cross-platform. */
const OLD_REGISTRY_RELATIVE = ".claude/plans-registry.json";

function createEmptyRegistry(): PlansRegistry {
	return {
		version: 1,
		plans: [],
		stats: { totalPlans: 0, completedPlans: 0, avgPhasesPerPlan: 0 },
	};
}

/**
 * Delete old project-local registry and backup files after migration.
 */
function deleteOldFiles(oldPath: string, oldBak: string): void {
	try {
		unlinkSync(oldPath);
	} catch {
		/* ignore — file may not exist */
	}
	try {
		unlinkSync(oldBak);
	} catch {
		/* ignore — file may not exist */
	}
}

/**
 * Auto-migrate from legacy project-local .claude/plans-registry.json to global path.
 * - If old file exists and global doesn't: migrate data, then delete old files
 * - If global already exists: just clean up old files (already migrated)
 * - If old file is corrupt/invalid: skip migration, preserve old files for manual recovery
 *
 * Handles legacy data that may be missing fields (e.g. lastModified) by filling
 * defaults before validation.
 */
function migrateFromProjectLocal(cwd: string, globalPath: string): void {
	const oldPath = join(cwd, OLD_REGISTRY_RELATIVE);
	const oldBak = `${oldPath}.bak`;

	if (!existsSync(oldPath)) return;

	// If global already exists, just clean up old files (already migrated)
	if (existsSync(globalPath)) {
		deleteOldFiles(oldPath, oldBak);
		return;
	}

	// Try to read and validate old file
	try {
		const oldData = JSON.parse(readFileSync(oldPath, "utf8"));
		if (oldData && typeof oldData === "object" && Array.isArray(oldData.plans)) {
			// Fill missing fields with defaults for legacy entries
			const migrated = {
				version: 1,
				plans: oldData.plans.map((p: Record<string, unknown>) => ({
					lastModified: p.created ?? new Date().toISOString(),
					tags: [],
					blockedBy: [],
					blocks: [],
					...p,
				})),
				stats: oldData.stats ?? {
					totalPlans: 0,
					completedPlans: 0,
					avgPhasesPerPlan: 0,
				},
			};
			const parsed = PlansRegistrySchema.safeParse(migrated);
			if (parsed.success) {
				writeRegistry(parsed.data, cwd);
				deleteOldFiles(oldPath, oldBak);
				return;
			}
		}
		// Invalid structure — keep old files for manual recovery
	} catch (err) {
		// Corrupt or unreadable file — keep old files for manual recovery
		console.warn("[ck] plans-registry migration failed:", err instanceof Error ? err.message : err);
	}
}

function normalizeRegistryDir(cwd: string, dir: string): string {
	const absoluteDir = isAbsolute(dir) ? dir : resolve(cwd, dir);
	const relativeDir = relative(cwd, absoluteDir) || dir;
	return relativeDir.replace(/\\/g, "/");
}

/**
 * Find the project root by walking up directories looking for .claude/ or .git/.
 * Falls back to the given startDir if no markers found.
 */
export function findProjectRoot(startDir: string): string {
	let dir = startDir;
	const root = parse(dir).root;

	while (dir !== root) {
		// Check for .claude/ or .git/ markers
		if (existsSync(join(dir, ".claude")) || existsSync(join(dir, ".git"))) {
			return dir;
		}
		dir = dirname(dir);
	}

	// No markers found, return original directory
	return startDir;
}

/**
 * Read the plans registry from global disk location.
 * Auto-migrates from old project-local path if needed.
 * Returns empty registry if file doesn't exist.
 * @param cwd - Must be the project root (e.g. from findProjectRoot()).
 *              Passing a subdirectory produces a different hash and a separate registry file.
 */
export function readRegistry(cwd = process.cwd()): PlansRegistry {
	const globalPath = PathResolver.getPlansRegistryPath(cwd);

	// Auto-migrate from old project-local path if needed
	migrateFromProjectLocal(cwd, globalPath);

	if (!existsSync(globalPath)) {
		return createEmptyRegistry();
	}
	try {
		const parsed = PlansRegistrySchema.safeParse(JSON.parse(readFileSync(globalPath, "utf8")));
		return parsed.success ? parsed.data : createEmptyRegistry();
	} catch {
		// Corrupted registry — return empty
		return createEmptyRegistry();
	}
}

/**
 * Write the plans registry to global disk location.
 * Sets projectRoot for dashboard discovery.
 * Creates backup before write for safety.
 * @param cwd - Must be the project root (e.g. from findProjectRoot()).
 *              Passing a subdirectory produces a different hash and a separate registry file.
 */
export function writeRegistry(registry: PlansRegistry, cwd = process.cwd()): void {
	const globalPath = PathResolver.getPlansRegistryPath(cwd);

	// Set projectRoot for dashboard discovery (spread to avoid mutating caller's object)
	const toWrite = { ...registry, projectRoot: cwd };
	const validated = PlansRegistrySchema.parse(toWrite);

	// Ensure global directory exists
	mkdirSync(dirname(globalPath), { recursive: true });

	// Backup before write
	if (existsSync(globalPath)) {
		try {
			writeFileSync(`${globalPath}.bak`, readFileSync(globalPath));
		} catch {
			// Ignore backup failures
		}
	}

	const tempPath = `${globalPath}.tmp-${process.pid}-${Date.now()}`;
	writeFileSync(tempPath, JSON.stringify(validated, null, 2), "utf8");
	renameSync(tempPath, globalPath);
}

/**
 * Recompute registry stats from plans array.
 */
function computeStats(plans: PlansRegistryEntry[]): PlansRegistry["stats"] {
	const totalPlans = plans.length;
	const completedPlans = plans.filter((p) => p.status === "done").length;
	const totalPhases = plans.reduce((sum, p) => sum + p.phases.length, 0);
	const avgPhasesPerPlan = totalPlans > 0 ? totalPhases / totalPlans : 0;

	return { totalPlans, completedPlans, avgPhasesPerPlan };
}

/**
 * Convert plan status to registry status.
 * Plan frontmatter uses: pending | in-progress | completed
 * PlanBoardStatus (from normalizePlanStatus) uses: pending | in-progress | in-review | done | cancelled
 * Registry uses: pending | in-progress | in-review | done | cancelled
 */
function toRegistryStatus(
	planStatus: string,
): "pending" | "in-progress" | "in-review" | "done" | "cancelled" {
	switch (planStatus) {
		case "completed":
		case "done":
			return "done";
		case "in-progress":
			return "in-progress";
		case "in-review":
			return "in-review";
		case "cancelled":
			return "cancelled";
		default:
			return "pending";
	}
}

/**
 * Update or create a registry entry for a plan.
 * Partial updates are merged with existing entry.
 */
export function updateRegistryEntry(
	entry: Partial<PlansRegistryEntry> & { dir: string },
	cwd = process.cwd(),
): void {
	const registry = readRegistry(cwd);
	const now = new Date().toISOString();

	// Normalize dir to relative path
	const relativeDir = normalizeRegistryDir(cwd, entry.dir);
	const normalizedEntry = { ...entry, dir: relativeDir };

	const idx = registry.plans.findIndex((p) => p.dir === relativeDir);
	if (idx >= 0) {
		// Merge with existing entry
		registry.plans[idx] = {
			...registry.plans[idx],
			...normalizedEntry,
			lastModified: now,
		};
	} else {
		// Create new entry (fill required fields with defaults if missing)
		const newEntry: PlansRegistryEntry = {
			dir: relativeDir,
			title: normalizedEntry.title ?? "Untitled Plan",
			status: normalizedEntry.status ?? "pending",
			priority: normalizedEntry.priority,
			branch: normalizedEntry.branch,
			tags: normalizedEntry.tags ?? [],
			blockedBy: normalizedEntry.blockedBy ?? [],
			blocks: normalizedEntry.blocks ?? [],
			created: normalizedEntry.created ?? now,
			createdBy: normalizedEntry.createdBy ?? "ck-cli",
			source: normalizedEntry.source ?? "cli",
			lastModified: now,
			phases: normalizedEntry.phases ?? [],
			progressPct: normalizedEntry.progressPct ?? 0,
		};
		registry.plans.push(newEntry);
	}

	// Recompute stats
	registry.stats = computeStats(registry.plans);

	writeRegistry(registry, cwd);
}

/**
 * Create a new registry entry from plan creation options.
 */
export function registerNewPlan(options: {
	dir: string;
	title: string;
	priority?: "P1" | "P2" | "P3";
	source?: PlanSource;
	phases: string[];
	cwd?: string;
}): void {
	const now = new Date().toISOString();
	const source = options.source ?? "cli";
	const createdBy =
		source === "skill" ? "ck:plan" : source === "dashboard" ? "dashboard" : "ck-cli";

	updateRegistryEntry(
		{
			dir: options.dir,
			title: options.title,
			status: "pending",
			priority: options.priority,
			created: now,
			createdBy,
			source,
			phases: options.phases,
			progressPct: 0,
		},
		options.cwd,
	);
}

/**
 * Update registry entry after phase status change.
 */
export function updateRegistryPhaseStatus(options: {
	planDir: string;
	planStatus: string;
	progressPct: number;
	cwd?: string;
}): void {
	updateRegistryEntry(
		{
			dir: options.planDir,
			status: toRegistryStatus(options.planStatus),
			progressPct: options.progressPct,
		},
		options.cwd,
	);
}

/**
 * Update registry entry after adding a new phase.
 */
export function updateRegistryAddPhase(options: {
	planDir: string;
	phaseId: string;
	cwd?: string;
}): void {
	const registry = readRegistry(options.cwd);
	const relativeDir = normalizeRegistryDir(options.cwd ?? process.cwd(), options.planDir);
	const entry = registry.plans.find((p) => p.dir === relativeDir);

	if (entry) {
		if (!entry.phases.includes(options.phaseId)) {
			entry.phases.push(options.phaseId);
			// Recalculate progress (new phase is pending, so progress decreases)
			entry.progressPct = Math.round(
				((entry.phases.length - 1) / entry.phases.length) * entry.progressPct,
			);
			entry.lastModified = new Date().toISOString();
			registry.stats = computeStats(registry.plans);
			writeRegistry(registry, options.cwd);
		}
	}
}
