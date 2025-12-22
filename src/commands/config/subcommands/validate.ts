import { ConfigSchemaWithDescriptions } from "@/domains/config/schema-descriptions.js";
import { PathResolver } from "@/shared/path-resolver.js";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import pc from "picocolors";

export async function validateConfig(options: { global?: boolean }) {
	const errors: string[] = [];
	const warnings: string[] = [];

	// Validate global config
	const globalPath = PathResolver.getConfigFile(true);
	if (existsSync(globalPath)) {
		const result = await validateFile(globalPath, "global");
		errors.push(...result.errors);
		warnings.push(...result.warnings);
	}

	// Validate local config
	if (!options.global) {
		const localPath = join(process.cwd(), ".claude", ".ck.json");
		if (existsSync(localPath)) {
			const result = await validateFile(localPath, "local");
			errors.push(...result.errors);
			warnings.push(...result.warnings);
		}
	}

	// Output results
	if (errors.length === 0 && warnings.length === 0) {
		console.log(pc.green("Configuration is valid"));
		return;
	}

	for (const warning of warnings) {
		console.log(pc.yellow(`Warning: ${warning}`));
	}

	for (const error of errors) {
		console.log(pc.red(`Error: ${error}`));
	}

	if (errors.length > 0) {
		process.exitCode = 1;
	}
}

async function validateFile(
	path: string,
	scope: string,
): Promise<{ errors: string[]; warnings: string[] }> {
	const errors: string[] = [];
	const warnings: string[] = [];

	try {
		const content = await readFile(path, "utf-8");
		const data = JSON.parse(content);

		// Validate against schema
		const result = ConfigSchemaWithDescriptions.safeParse(data);
		if (!result.success) {
			for (const issue of result.error.issues) {
				errors.push(`[${scope}] ${issue.path.join(".")}: ${issue.message}`);
			}
		}
	} catch (error) {
		if (error instanceof SyntaxError) {
			errors.push(`[${scope}] Invalid JSON: ${error.message}`);
		} else {
			errors.push(`[${scope}] ${error instanceof Error ? error.message : "Unknown error"}`);
		}
	}

	return { errors, warnings };
}
