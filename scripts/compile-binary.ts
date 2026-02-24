#!/usr/bin/env bun
/**
 * Compile CLI binary with embedded UI assets.
 *
 * Usage:
 *   bun run scripts/compile-binary.ts [--outfile path] [--target platform]
 *
 * Strategy: Generate a temporary loader module that imports every file in
 * dist/ui/ with `{ type: "file" }`. This tells Bun to embed them as static
 * assets (not JS entrypoints), making them available via Bun.embeddedFiles.
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { relative, sep } from "node:path";
import { Glob } from "bun";

// Parse CLI args
const args = process.argv.slice(2);
let outfile = "ck";
let target: string | undefined;

for (let i = 0; i < args.length; i++) {
	if (args[i] === "--outfile" && args[i + 1]) {
		outfile = args[++i];
	} else if (args[i] === "--target" && args[i + 1]) {
		target = args[++i];
	}
}

// Ensure UI dist exists
if (!existsSync("dist/ui/index.html")) {
	console.error("❌ dist/ui/index.html not found. Run 'bun run ui:build' first.");
	process.exit(1);
}

// Collect UI files to embed
const glob = new Glob("dist/ui/**/*");
const uiFiles = Array.from(glob.scanSync({ dot: false })).filter(
	(f) => !f.endsWith("/") && existsSync(f),
);

console.log(`📦 Embedding ${uiFiles.length} UI assets into binary...`);

// Generate a loader module with static imports for each UI file
// This ensures Bun treats them as embedded assets, not JS entrypoints
const loaderDir = ".tmp-compile";
const loaderPath = `${loaderDir}/ui-embed-loader.ts`;
mkdirSync(loaderDir, { recursive: true });

const imports = uiFiles
	.map((f, i) => {
		// Normalize to POSIX separators for ES import paths (Windows compat)
		const relPath = relative(loaderDir, f).split(sep).join("/");
		return `import _f${i} from "${relPath}" with { type: "file" };`;
	})
	.join("\n");

// Reference all imports to prevent tree-shaking
const refs = uiFiles.map((_, i) => `_f${i}`).join(", ");
const loaderContent = [
	"// Auto-generated — embeds UI assets into compiled binary",
	imports,
	`const _all = [${refs}];`,
	"// Prevent dead code elimination",
	"if (typeof _all === 'undefined') throw new Error('unreachable');",
	"",
].join("\n");

writeFileSync(loaderPath, loaderContent);

try {
	const buildConfig: Parameters<typeof Bun.build>[0] = {
		entrypoints: ["src/index.ts", loaderPath],
		compile: {
			outfile,
			...(target ? { target: target as any } : {}),
		},
		naming: {
			// Preserve directory structure in embedded blob names
			asset: "[dir]/[name].[ext]",
		},
	};

	const result = await Bun.build(buildConfig);

	if (!result.success) {
		console.error("❌ Build failed:");
		for (const log of result.logs) {
			console.error(`  ${log}`);
		}
		process.exit(1);
	}

	console.log(`✅ Binary compiled: ${outfile}`);
} finally {
	// Cleanup temp loader
	rmSync(loaderDir, { recursive: true, force: true });
}
