import pLimit from "p-limit";

/**
 * Default concurrency limit for file operations.
 * 50 is conservative for Windows (default ulimit ~2048).
 * Prevents EMFILE "too many open files" errors.
 */
const DEFAULT_CONCURRENCY = 50;

/**
 * Execute async operations with concurrency limiting.
 * Prevents EMFILE errors when processing many files.
 *
 * @param items Items to process
 * @param fn Async function to apply to each item
 * @param concurrency Max concurrent operations (default: 50)
 * @returns Results in same order as input
 */
export async function mapWithLimit<T, R>(
	items: T[],
	fn: (item: T) => Promise<R>,
	concurrency = DEFAULT_CONCURRENCY,
): Promise<R[]> {
	const limit = pLimit(concurrency);
	return Promise.all(items.map((item) => limit(() => fn(item))));
}
