const MIN_PM_TIMEOUT_MS = 500;
const MAX_PM_TIMEOUT_MS = 60_000;
const DEFAULT_PM_VERSION_COMMAND_TIMEOUT_MS = 3_000;
const DEFAULT_PM_QUERY_TIMEOUT_MS = 5_000;

/**
 * Parse and clamp a timeout value from an environment variable.
 * Shared between PM and npm timeout configs.
 */
export function parseTimeoutMs(
	rawValue: string | undefined,
	fallback: number,
	min = MIN_PM_TIMEOUT_MS,
	max = MAX_PM_TIMEOUT_MS,
): number {
	if (!rawValue) {
		return fallback;
	}

	const parsed = Number.parseInt(rawValue, 10);
	if (Number.isNaN(parsed)) {
		return fallback;
	}

	if (parsed < min) {
		return min;
	}
	if (parsed > max) {
		return max;
	}
	return parsed;
}

/**
 * Timeout for short package-manager commands.
 * Evaluated lazily so tests can override env vars after module load.
 */
export function getPmVersionCommandTimeoutMs(): number {
	return parseTimeoutMs(
		process.env.CK_PM_VERSION_TIMEOUT_MS,
		DEFAULT_PM_VERSION_COMMAND_TIMEOUT_MS,
	);
}

/**
 * Timeout for package-manager ownership queries.
 * Evaluated lazily so tests can override env vars after module load.
 */
export function getPmQueryTimeoutMs(): number {
	return parseTimeoutMs(process.env.CK_PM_QUERY_TIMEOUT_MS, DEFAULT_PM_QUERY_TIMEOUT_MS);
}
