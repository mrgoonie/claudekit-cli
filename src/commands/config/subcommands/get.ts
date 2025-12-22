import { ResolutionTracer } from "@/domains/config/resolution-tracer.js";
import pc from "picocolors";

export async function getConfig(key: string, options: { global?: boolean }) {
	const result = await ResolutionTracer.trace(process.cwd(), options.global);
	const traced = result.traced[key];

	if (!traced) {
		console.error(pc.red(`Key not found: ${key}`));
		process.exitCode = 1;
		return;
	}

	const badge =
		traced.source === "DEFAULT"
			? pc.dim("[DEFAULT]")
			: traced.source === "GLOBAL"
				? pc.blue("[GLOBAL]")
				: pc.yellow("[LOCAL]");

	console.log(`${traced.value} ${badge}`);
}
