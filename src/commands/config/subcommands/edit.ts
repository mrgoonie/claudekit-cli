import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { PathResolver } from "@/shared/path-resolver.js";
import pc from "picocolors";

export async function editConfig(options: { global?: boolean }) {
	const isGlobal = options.global ?? false;
	const configPath = isGlobal
		? PathResolver.getConfigFile(true)
		: join(process.cwd(), ".claude", ".ck.json");

	// Create file if doesn't exist
	if (!existsSync(configPath)) {
		const dir = dirname(configPath);
		if (!existsSync(dir)) await mkdir(dir, { recursive: true });
		await writeFile(configPath, "{}\n", "utf-8");
		console.log(pc.dim(`Created: ${configPath}`));
	}

	// Get editor
	const editor = process.env.EDITOR || process.env.VISUAL || "vi";

	console.log(pc.dim(`Opening ${configPath} with ${editor}...`));

	// Open editor
	const child = spawn(editor, [configPath], {
		stdio: "inherit",
	});

	return new Promise<void>((resolve, reject) => {
		child.on("exit", (code) => {
			if (code === 0) {
				console.log(pc.green("Config saved"));
				resolve();
			} else {
				reject(new Error(`Editor exited with code ${code}`));
			}
		});
		child.on("error", reject);
	});
}
