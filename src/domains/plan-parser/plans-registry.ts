/**
 * Plans Registry
 * Maintains .claude/plans-registry.json as an index of all plans with metadata.
 * Auto-updates on create, check, uncheck, add-phase operations.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, parse, relative, resolve } from "node:path";
import {
	type PlanSource,
	type PlansRegistry,
	type PlansRegistryEntry,
	PlansRegistrySchema,
} from "./plan-types.js";

const REGISTRY_PATH = ".claude/plans-registry.json";

function createEmptyRegistry(): PlansRegistry {
	return {
		version: 1,
		plans: [],
		stats: { totalPlans: 0, completedPlans: 0, avgPhasesPerPlan: 0 },
	};
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
 * Read the plans registry from disk.
 * Returns empty registry if file doesn't exist.
 */
export function readRegistry(cwd = process.cwd()): PlansRegistry {
	const path = join(cwd, REGISTRY_PATH);
	if (!existsSync(path)) {
		return createEmptyRegistry();
	}
	try {
		const parsed = PlansRegistrySchema.safeParse(JSON.parse(readFileSync(path, "utf8")));
		return parsed.success ? parsed.data : createEmptyRegistry();
	} catch {
		// Corrupted registry — return empty
		return createEmptyRegistry();
	}
}

/**
 * Write the plans registry to disk.
 * Creates backup before write for safety.
 */
export function writeRegistry(registry: PlansRegistry, cwd = process.cwd()): void {
	const path = join(cwd, REGISTRY_PATH);
	mkdirSync(dirname(path), { recursive: true });
	const validated = PlansRegistrySchema.parse(registry);

	// Backup before write
	if (existsSync(path)) {
		try {
			writeFileSync(`${path}.bak`, readFileSync(path));
		} catch {
			// Ignore backup failures
		}
	}

	const tempPath = `${path}.tmp-${process.pid}-${Date.now()}`;
	writeFileSync(tempPath, JSON.stringify(validated, null, 2), "utf8");
	renameSync(tempPath, path);
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
