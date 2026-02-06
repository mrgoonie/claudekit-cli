/**
 * Health Check API Routes
 *
 * Provides REST API endpoints for system health checks and auto-healing.
 */

import {
	AuthChecker,
	AutoHealer,
	type CheckGroup,
	CheckRunner,
	type CheckSummary,
	ClaudekitChecker,
	type HealingSummary,
	NetworkChecker,
	PlatformChecker,
	SystemChecker,
} from "@/domains/health-checks/index.js";
import type { Express, Request, Response } from "express";

/**
 * In-memory cache for check results
 * TTL: 5 minutes
 */
interface CacheEntry {
	summary: CheckSummary;
	timestamp: number;
}

const checkCache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get cached check result if valid
 */
function getCachedResult(cacheKey: string): CheckSummary | null {
	const entry = checkCache.get(cacheKey);
	if (!entry) return null;

	const age = Date.now() - entry.timestamp;
	if (age > CACHE_TTL) {
		checkCache.delete(cacheKey);
		return null;
	}

	return entry.summary;
}

/**
 * Cache check result
 */
function cacheResult(cacheKey: string, summary: CheckSummary): void {
	checkCache.set(cacheKey, {
		summary,
		timestamp: Date.now(),
	});
}

/**
 * Run all health checks with optional group filtering
 */
async function runHealthChecks(groups?: CheckGroup[]): Promise<CheckSummary> {
	const runner = new CheckRunner({ groups });

	// Register all domain checkers
	runner.registerChecker(new SystemChecker());
	runner.registerChecker(new ClaudekitChecker());
	runner.registerChecker(new AuthChecker());
	runner.registerChecker(new PlatformChecker());
	runner.registerChecker(new NetworkChecker());

	return await runner.run();
}

/**
 * Register doctor API routes
 */
export function registerDoctorRoutes(app: Express): void {
	/**
	 * GET /api/doctor/check
	 * Run health checks with optional group filtering
	 *
	 * Query params:
	 * - groups: Comma-separated list of check groups (system,auth,claudekit,platform,network)
	 *
	 * Returns: CheckSummary JSON (without fix functions)
	 */
	app.get("/api/doctor/check", async (req: Request, res: Response) => {
		try {
			const groupsParam = req.query.groups;
			const groups = groupsParam ? (String(groupsParam).split(",") as CheckGroup[]) : undefined;

			// Generate cache key from groups
			const cacheKey = groups ? groups.sort().join(",") : "all";

			// Check cache first
			const cached = getCachedResult(cacheKey);
			if (cached) {
				// Remove fix functions (not serializable)
				const sanitized = {
					...cached,
					checks: cached.checks.map(({ fix, ...rest }) => rest),
				};
				return res.json(sanitized);
			}

			// Run checks
			const summary = await runHealthChecks(groups);

			// Cache result
			cacheResult(cacheKey, summary);

			// Remove fix functions (not serializable)
			const sanitized = {
				...summary,
				checks: summary.checks.map(({ fix, ...rest }) => rest),
			};

			return res.json(sanitized);
		} catch (error) {
			return res.status(500).json({
				error: "Health check failed",
				message: error instanceof Error ? error.message : String(error),
			});
		}
	});

	/**
	 * POST /api/doctor/fix
	 * Run auto-healer on specific check IDs
	 *
	 * Body: { checkIds: string[] }
	 *
	 * Returns: HealingSummary JSON
	 */
	app.post("/api/doctor/fix", async (req: Request, res: Response): Promise<void> => {
		try {
			const { checkIds } = req.body as { checkIds?: unknown };

			if (!Array.isArray(checkIds)) {
				res.status(400).json({
					error: "Invalid request",
					message: "checkIds must be an array",
				});
				return;
			}

			if (checkIds.length === 0) {
				res.status(400).json({
					error: "Invalid request",
					message: "checkIds array cannot be empty",
				});
				return;
			}

			// Run checks first to get fixable items
			// Don't use cache for fix operations (need fresh state)
			const summary = await runHealthChecks();

			// Filter checks to only those requested
			const requestedCheckIds = new Set(checkIds as string[]);
			const checksToFix = summary.checks.filter((check) => requestedCheckIds.has(check.id));

			if (checksToFix.length === 0) {
				res.status(404).json({
					error: "No matching checks found",
					message: `None of the provided check IDs were found: ${(checkIds as string[]).join(", ")}`,
				});
				return;
			}

			// Run auto-healer on filtered checks
			const healer = new AutoHealer();
			const healingResult: HealingSummary = await healer.healAll(checksToFix);

			// Invalidate cache after fixes
			checkCache.clear();

			res.json(healingResult);
		} catch (error) {
			res.status(500).json({
				error: "Auto-heal failed",
				message: error instanceof Error ? error.message : String(error),
			});
		}
	});
}
