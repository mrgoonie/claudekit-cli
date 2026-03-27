/**
 * Handler for `ck api services` — list available proxy services
 */

import { createApiClient } from "@/domains/claudekit-api/index.js";
import { createSpinner } from "@/shared/safe-spinner.js";
import { ServicesListSchema } from "@/types/claudekit-api.js";
import type { ApiServicesOptions } from "../types.js";

export async function handleApiServices(options: ApiServicesOptions): Promise<void> {
	const spinner = createSpinner("Fetching services...");
	spinner.start();

	try {
		const client = createApiClient();
		const response = await client.request<unknown>("/api/proxy/services");
		spinner.succeed("Services loaded");

		const parsed = ServicesListSchema.safeParse(response.data);
		const services = parsed.success ? parsed.data.services : [];

		if (!parsed.success) {
			console.error("  Warning: Unexpected service list format");
		}

		if (options.json) {
			process.stdout.write(JSON.stringify(response.data, null, 2));
			return;
		}

		console.log();
		if (services.length === 0) {
			console.log("  No services available.");
		} else {
			for (const svc of services) {
				const desc = svc.description ?? svc.name ?? "";
				console.log(`  ${svc.id.padEnd(14)} ${desc}`);
			}
		}
		console.log();
	} catch (error) {
		spinner.fail("Failed to load services");
		if (error instanceof Error) console.error(`  ${error.message}`);
		process.exitCode = 1;
	}
}
