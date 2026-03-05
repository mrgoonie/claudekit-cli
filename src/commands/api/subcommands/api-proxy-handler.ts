/**
 * Handler for `ck api proxy <service> <path>` — generic proxy fallback
 */

import { createApiClient } from "@/domains/claudekit-api/index.js";
import { createSpinner } from "@/shared/safe-spinner.js";
import type { ApiProxyOptions } from "../types.js";

/**
 * Parse JSON string from --query flag into Record<string, string>
 */
function parseQueryJson(raw: string): Record<string, string> {
	try {
		const parsed = JSON.parse(raw);
		if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
			throw new Error("--query must be a JSON object");
		}
		const result: Record<string, string> = {};
		for (const [k, v] of Object.entries(parsed)) {
			result[k] = String(v);
		}
		return result;
	} catch (error) {
		if (error instanceof SyntaxError) {
			throw new Error('Invalid JSON in --query. Expected format: \'{"key":"value"}\'');
		}
		throw error;
	}
}

export async function handleApiProxy(
	service: string,
	path: string,
	options: ApiProxyOptions,
): Promise<void> {
	const proxyPath = `/api/proxy/${service}${path ? `/${path.replace(/^\//, "")}` : ""}`;
	const method = (options.method as "GET" | "POST" | "PUT" | "PATCH" | "DELETE") ?? "GET";

	let query: Record<string, string> | undefined;
	if (options.query) {
		try {
			query = parseQueryJson(options.query);
		} catch (error) {
			console.error(error instanceof Error ? error.message : "Invalid --query");
			process.exitCode = 1;
			return;
		}
	}

	let body: unknown;
	if (options.body) {
		try {
			body = JSON.parse(options.body);
		} catch {
			console.error("Invalid JSON in --body. Expected valid JSON string.");
			process.exitCode = 1;
			return;
		}
	}

	const spinner = createSpinner(`${method} ${proxyPath}...`);
	spinner.start();

	try {
		const client = createApiClient();
		const response = await client.request<unknown>(proxyPath, { method, body, query });
		spinner.succeed("Done");

		if (options.json) {
			process.stdout.write(JSON.stringify(response.data, null, 2));
			return;
		}

		console.log(JSON.stringify(response.data, null, 2));
		const rl = response.rateLimit;
		if (rl.remaining > 0 || rl.limit > 0) {
			console.log(`\n  Rate limit: ${rl.remaining}/${rl.limit}`);
		}
	} catch (error) {
		spinner.fail("Request failed");
		if (error instanceof Error) console.error(`  ${error.message}`);
		process.exitCode = 1;
	}
}
