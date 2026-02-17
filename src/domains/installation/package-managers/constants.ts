const MIN_PM_TIMEOUT_MS = 500;
const MAX_PM_TIMEOUT_MS = 60_000;
const DEFAULT_PM_VERSION_COMMAND_TIMEOUT_MS = 3_000;
const DEFAULT_PM_QUERY_TIMEOUT_MS = 5_000;

function parseTimeoutMs(rawValue: string | undefined, fallback: number): number {
	if (!rawValue) {
		return fallback;
	}

	const parsed = Number.parseInt(rawValue, 10);
	if (Number.isNaN(parsed)) {
		return fallback;
	}

	if (parsed < MIN_PM_TIMEOUT_MS) {
		return MIN_PM_TIMEOUT_MS;
	}
	if (parsed > MAX_PM_TIMEOUT_MS) {
		return MAX_PM_TIMEOUT_MS;
	}
	return parsed;
}

/**
 * Timeout for short package-manager commands.
 */
export const PM_VERSION_COMMAND_TIMEOUT_MS = parseTimeoutMs(
	process.env.CK_PM_VERSION_TIMEOUT_MS,
	DEFAULT_PM_VERSION_COMMAND_TIMEOUT_MS,
);

/**
 * Timeout for package-manager ownership queries.
 */
export const PM_QUERY_TIMEOUT_MS = parseTimeoutMs(
	process.env.CK_PM_QUERY_TIMEOUT_MS,
	DEFAULT_PM_QUERY_TIMEOUT_MS,
);
