import { ResolutionTracer } from "@/domains/config/resolution-tracer.js";

export async function previewConfig(options: { json?: boolean }) {
	const result = await ResolutionTracer.trace(process.cwd(), false);

	if (options.json) {
		console.log(JSON.stringify(result.merged, null, 2));
	} else {
		console.log("\nMerged Configuration Preview");
		console.log("=============================\n");
		console.log(JSON.stringify(unflatten(result.merged), null, 2));
	}
}

function unflatten(obj: Record<string, unknown>): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(obj)) {
		const keys = key.split(".");
		let current = result;
		for (let i = 0; i < keys.length - 1; i++) {
			if (!(keys[i] in current)) current[keys[i]] = {};
			current = current[keys[i]] as Record<string, unknown>;
		}
		current[keys[keys.length - 1]] = value;
	}
	return result;
}
