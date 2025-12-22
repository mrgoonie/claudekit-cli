import { ResolutionTracer, type TracedValue } from "@/domains/config/resolution-tracer.js";
import pc from "picocolors";

export async function showConfig(options: { global?: boolean; local?: boolean; json?: boolean }) {
	const result = await ResolutionTracer.trace(process.cwd(), options.global);

	if (options.json) {
		console.log(JSON.stringify(result.merged, null, 2));
		return;
	}

	console.log("\nClaudeKit Configuration");
	console.log("=======================\n");

	// Group by section
	const sections: Record<string, Array<TracedValue & { path: string }>> = {};
	for (const [key, traced] of Object.entries(result.traced)) {
		const section = key.split(".")[0];
		if (!sections[section]) sections[section] = [];
		sections[section].push({ ...traced, path: key });
	}

	for (const [section, values] of Object.entries(sections)) {
		console.log(pc.bold(pc.cyan(section.toUpperCase())));
		for (const { path, value, source } of values) {
			const badge = getBadge(source);
			const displayValue = typeof value === "string" ? value : JSON.stringify(value);
			console.log(`  ${path.padEnd(25)} ${pc.green(displayValue)} ${badge}`);
		}
		console.log();
	}
}

function getBadge(source: string): string {
	switch (source) {
		case "DEFAULT":
			return pc.dim("[DEFAULT]");
		case "GLOBAL":
			return pc.blue("[GLOBAL]");
		case "LOCAL":
			return pc.yellow("[LOCAL]");
		default:
			return "";
	}
}
