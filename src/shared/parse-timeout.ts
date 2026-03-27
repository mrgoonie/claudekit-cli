/**
 * Parse and clamp a timeout value from an environment variable.
 * Shared utility for configurable timeout constants across domains.
 */
export function parseTimeoutMs(
	rawValue: string | undefined,
	fallback: number,
	min = 500,
	max = 60_000,
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
