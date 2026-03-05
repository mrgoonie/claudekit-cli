#!/usr/bin/env node

import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const distDir = join(process.cwd(), "dist");
const uiDir = join(distDir, "ui");
const indexHtml = join(uiDir, "index.html");
const cliBundle = join(distDir, "index.js");

const errors = [];

// Check CLI bundle
if (!existsSync(cliBundle)) {
	errors.push(`Missing CLI bundle: ${cliBundle}`);
} else {
	const cliSize = statSync(cliBundle).size;
	const cliSizeMB = (cliSize / 1024 / 1024).toFixed(2);
	console.log(`CLI bundle size: ${cliSizeMB}MB`);

	if (cliSize > 1024 * 1024) {
		console.warn(`Warning: CLI bundle exceeds 1MB (${cliSizeMB}MB)`);
	}
}

// Check UI build
if (!existsSync(uiDir)) {
	errors.push(`Missing UI dist folder: ${uiDir}`);
} else if (!existsSync(indexHtml)) {
	errors.push(`Missing UI index.html: ${indexHtml}`);
} else {
	// Calculate UI bundle size
	const getSize = (dir) => {
		let size = 0;
		const files = readdirSync(dir);
		for (const file of files) {
			const path = join(dir, file);
			const stat = statSync(path);
			if (stat.isDirectory()) {
				size += getSize(path);
			} else {
				size += stat.size;
			}
		}
		return size;
	};

	const uiSize = getSize(uiDir);
	const uiSizeMB = (uiSize / 1024 / 1024).toFixed(2);
	console.log(`UI bundle size: ${uiSizeMB}MB`);

	if (uiSize > 5 * 1024 * 1024) {
		console.warn(`Warning: UI bundle exceeds 5MB (${uiSizeMB}MB)`);
	}
}

if (errors.length > 0) {
	console.error("\nPre-publish check failed:\n");
	errors.forEach((e) => console.error(`  - ${e}`));
	console.error("\nRun 'bun run build' to fix.\n");
	process.exit(1);
}

console.log("\nPre-publish check passed!");
