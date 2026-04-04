#!/usr/bin/env node

/**
 * Release dry-run CI gate — fast pre-merge validation of npm package integrity.
 *
 * Runs `npm pack --dry-run --json` to validate what would be published without
 * creating a tarball or requiring npm credentials. Catches common release issues:
 * - Missing critical files (bin/ck.js, dist/index.js, dist/ui/)
 * - Accidentally included source or sensitive files
 * - Broken bin field pointing to non-existent file
 * - Misconfigured package.json files field
 *
 * This is intentionally lighter than scripts/prepublish-check.js (no smoke install,
 * no dashboard runtime test). It gates PRs; prepublish-check runs at release time.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Files that MUST be present in the published package
const REQUIRED_FILES = ["package/bin/ck.js", "package/dist/index.js", "package/dist/ui/index.html"];

// Paths that must NOT appear in the published package (security / cleanliness)
const FORBIDDEN_PATTERNS = [
	{ pattern: /^package\/src\//, label: "source directory (src/)" },
	{ pattern: /^package\/\.env/, label: "env file (.env*)" },
	{ pattern: /\.key$/, label: "private key file" },
	{ pattern: /\.pem$/, label: "PEM certificate/key file" },
	{ pattern: /\/node_modules\//, label: "nested node_modules" },
	{ pattern: /^package\/tests\//, label: "test directory (tests/)" },
	{ pattern: /^package\/scripts\//, label: "scripts directory (scripts/)" },
	{ pattern: /^package\/plans\//, label: "plans directory (plans/)" },
	{ pattern: /^package\/\.claude\//, label: ".claude directory" },
	{ pattern: /^package\/src-tauri\//, label: "Tauri source directory (src-tauri/)" },
];

function getNpmCommand() {
	return process.platform === "win32" ? "npm.cmd" : "npm";
}

function runNpmPackDryRun() {
	// --dry-run: list files without writing tarball (no npm auth needed)
	// --json: machine-readable output with file list
	// --ignore-scripts: skip prepublish hooks that may fail in CI
	// --silent: suppress npm lifecycle noise
	const raw = execFileSync(
		getNpmCommand(),
		["pack", "--dry-run", "--json", "--ignore-scripts", "--silent"],
		{ encoding: "utf8" },
	);

	// npm can prefix JSON with lifecycle output despite --ignore-scripts --silent.
	// Find the JSON array: "[" followed by optional whitespace then "{".
	// This skips "[OK]", "[i]", "[X]" prefixes since they aren't followed by "{".
	const jsonStart = raw.search(/\[\s*\{/);
	const jsonStr = jsonStart >= 0 ? raw.slice(jsonStart).trim() : raw.trim();

	let parsed;
	try {
		parsed = JSON.parse(jsonStr);
	} catch {
		throw new Error(`Failed to parse npm pack --dry-run output:\n${raw.trim()}`);
	}

	if (!Array.isArray(parsed) || parsed.length === 0) {
		throw new Error(`npm pack --dry-run returned unexpected payload:\n${raw.trim()}`);
	}

	return parsed[0];
}

function checkRequiredFiles(publishedPaths) {
	const missing = REQUIRED_FILES.filter((f) => !publishedPaths.has(f));
	if (missing.length > 0) {
		const top20 = Array.from(publishedPaths)
			.sort()
			.slice(0, 20)
			.map((f) => `     ${f}`)
			.join("\n");
		throw new Error(
			`[X] Missing required files in npm package:\n${missing.map((f) => `     - ${f}`).join("\n")}\n\n     Published paths (first 20):\n${top20}`,
		);
	}
}

function checkForbiddenFiles(publishedPaths) {
	const violations = [];
	for (const filePath of publishedPaths) {
		for (const { pattern, label } of FORBIDDEN_PATTERNS) {
			if (pattern.test(filePath)) {
				violations.push(`     - ${filePath}  (matches: ${label})`);
				break;
			}
		}
	}
	if (violations.length > 0) {
		throw new Error(`[X] Forbidden files found in npm package:\n${violations.join("\n")}`);
	}
}

function checkBinField(packageJson) {
	const { bin } = packageJson;
	if (!bin) {
		throw new Error('[X] package.json missing "bin" field');
	}

	const binEntries = typeof bin === "string" ? { ck: bin } : bin;
	const errors = [];

	for (const [name, relPath] of Object.entries(binEntries)) {
		const absPath = join(process.cwd(), relPath);
		if (!existsSync(absPath)) {
			errors.push(`     - bin["${name}"] = "${relPath}" — file not found`);
		}
	}

	if (errors.length > 0) {
		throw new Error(`[X] bin field references missing files:\n${errors.join("\n")}`);
	}
}

function checkFilesField(packageJson) {
	const { files } = packageJson;
	if (!files || !Array.isArray(files) || files.length === 0) {
		throw new Error(
			'[X] package.json "files" field is missing or empty — without it npm publishes everything',
		);
	}

	// Warn if bin/ and dist/ are not covered
	const hasBin = files.some((f) => f === "bin" || f === "bin/" || f.startsWith("bin/"));
	const hasDist = files.some((f) => f === "dist" || f === "dist/" || f.startsWith("dist/"));

	const warnings = [];
	if (!hasBin) {
		warnings.push(
			'  [!] "bin/" not listed in package.json "files" — bin entry may be missing from package',
		);
	}
	if (!hasDist) {
		warnings.push(
			'  [!] "dist/" not listed in package.json "files" — dist bundle may be missing from package',
		);
	}

	return warnings;
}

function printSummary(manifest, publishedPaths) {
	const totalKB = Math.round(manifest.size / 1024);
	const unpackedKB = Math.round(manifest.unpackedSize / 1024);
	console.log(`\nPackage: ${manifest.name}@${manifest.version}`);
	console.log(`Files: ${manifest.entryCount} | Packed: ${totalKB}KB | Unpacked: ${unpackedKB}KB`);
	console.log("\nIncluded paths:");
	for (const f of Array.from(publishedPaths).sort()) {
		console.log(`  ${f}`);
	}
}

function main() {
	console.log("[i] Release dry-run check (npm pack --dry-run)...\n");

	const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
	const warnings = [];

	// 1. Validate package.json fields before running npm pack
	try {
		checkBinField(packageJson);
		console.log("[OK] bin field references existing files");
	} catch (err) {
		console.error(err.message);
		process.exit(1);
	}

	const filesWarnings = checkFilesField(packageJson);
	if (filesWarnings.length === 0) {
		console.log("[OK] files field present and covers bin/ and dist/");
	} else {
		warnings.push(...filesWarnings);
		console.log("[OK] files field present");
	}

	// 2. Run npm pack --dry-run
	let manifest;
	try {
		manifest = runNpmPackDryRun();
	} catch (err) {
		console.error(`[X] npm pack --dry-run failed:\n     ${err.message}`);
		process.exit(1);
	}

	const publishedPaths = new Set((manifest.files || []).map((f) => `package/${f.path}`));

	// 3. Check required files
	try {
		checkRequiredFiles(publishedPaths);
		console.log(`[OK] All required files present (${REQUIRED_FILES.length} checked)`);
	} catch (err) {
		printSummary(manifest, publishedPaths);
		console.error(`\n${err.message}`);
		process.exit(1);
	}

	// 4. Check forbidden files
	try {
		checkForbiddenFiles(publishedPaths);
		console.log("[OK] No forbidden/sensitive files in package");
	} catch (err) {
		printSummary(manifest, publishedPaths);
		console.error(`\n${err.message}`);
		process.exit(1);
	}

	// 5. Print summary and any warnings
	printSummary(manifest, publishedPaths);

	if (warnings.length > 0) {
		console.log("\nWarnings:");
		for (const w of warnings) {
			console.log(w);
		}
	}

	console.log("\n[OK] Release dry-run check passed.");
}

// Only run when invoked directly
const isDirectExecution =
	process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isDirectExecution) {
	try {
		main();
	} catch (err) {
		console.error("[X] Unexpected error:", err instanceof Error ? err.message : String(err));
		process.exit(1);
	}
}
