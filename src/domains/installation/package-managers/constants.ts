import { parseTimeoutMs } from "@/shared/parse-timeout.js";

const DEFAULT_PM_VERSION_COMMAND_TIMEOUT_MS = 3_000;
const DEFAULT_PM_QUERY_TIMEOUT_MS = 5_000;

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
