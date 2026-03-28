#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import {
	copyFileSync,
	existsSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	rmSync,
	statSync,
	symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_PACK_FILES = [
	"package/bin/ck.js",
	"package/dist/index.js",
	"package/dist/ui/index.html",
];
const PLATFORM_BINARY_PACK_FILES = {
	"darwin-arm64": "package/bin/ck-darwin-arm64",
	"darwin-x64": "package/bin/ck-darwin-x64",
	"linux-x64": "package/bin/ck-linux-x64",
	"win32-x64": "package/bin/ck-win32-x64.exe",
};
const PLATFORM_BINARY_BUILD_ARTIFACTS = {
	"darwin-arm64": { path: "bin/ck-darwin-arm64", label: "macOS ARM binary" },
	"darwin-x64": { path: "bin/ck-darwin-x64", label: "macOS x64 binary" },
	"linux-x64": { path: "bin/ck-linux-x64", label: "Linux binary" },
	"win32-x64": { path: "bin/ck-win32-x64.exe", label: "Windows binary" },
};

function getCurrentPlatformKey() {
	return `${process.platform}-${process.arch}`;
}

function getNpmCommand() {
	return process.platform === "win32" ? "npm.cmd" : "npm";
}

function runCommandSync(command, args, options = {}) {
	// Windows .cmd/.bat files must run through a shell; execFileSync() cannot launch them directly.
	if (process.platform === "win32" && /\.(cmd|bat)$/i.test(command)) {
		const result = spawnSync(command, args, {
			...options,
			encoding: options.encoding ?? "utf8",
			shell: true,
			windowsHide: true,
		});

		if (result.error) {
			throw result.error;
		}

		if (result.status !== 0) {
			const stderr =
				typeof result.stderr === "string"
					? result.stderr.trim()
					: Buffer.isBuffer(result.stderr)
						? result.stderr.toString("utf8").trim()
						: "";
			const stdout =
				typeof result.stdout === "string"
					? result.stdout.trim()
					: Buffer.isBuffer(result.stdout)
						? result.stdout.toString("utf8").trim()
						: "";
			throw new Error(stderr || stdout || `Process exited with code ${result.status}`);
		}

		return result.stdout;
	}

	return execFileSync(command, args, options);
}

function resolveBinaryMode({ binaryMode, requireStableBinaries = true }) {
	if (binaryMode) {
		return binaryMode;
	}
	return requireStableBinaries ? "all" : "none";
}

function getRequiredBinaryPackFiles(binaryMode) {
	if (binaryMode === "none") {
		return [];
	}

	if (binaryMode === "host") {
		const currentPlatformBinary = PLATFORM_BINARY_PACK_FILES[getCurrentPlatformKey()];
		return currentPlatformBinary ? [currentPlatformBinary] : [];
	}

	return Object.values(PLATFORM_BINARY_PACK_FILES);
}

function getRequiredBinaryArtifacts(binaryMode) {
	if (binaryMode === "none") {
		return [];
	}

	if (binaryMode === "host") {
		const currentPlatformBinary = PLATFORM_BINARY_BUILD_ARTIFACTS[getCurrentPlatformKey()];
		return currentPlatformBinary
			? [
					{
						path: join(process.cwd(), currentPlatformBinary.path),
						label: currentPlatformBinary.label,
					},
				]
			: [];
	}

	return Object.values(PLATFORM_BINARY_BUILD_ARTIFACTS).map((artifact) => ({
		path: join(process.cwd(), artifact.path),
		label: artifact.label,
	}));
}

function parseJsonCommandOutput(rawOutput, label) {
	const trimmed = rawOutput.trim();
	if (!trimmed) {
		throw new Error(`${label} produced no output`);
	}

	const candidates = [trimmed];
	const trailingJsonArrayMatch = trimmed.match(/(\[\s*\{[\s\S]*\}\s*\])\s*$/);
	if (trailingJsonArrayMatch) {
		candidates.unshift(trailingJsonArrayMatch[1]);
	}

	for (const candidate of candidates) {
		try {
			return JSON.parse(candidate);
		} catch {
			// Try the next candidate. npm lifecycle output can prefix the JSON payload.
		}
	}

	throw new Error(`Failed to parse ${label} JSON output:\n${trimmed}`);
}

function parseArgs(argv) {
	const args = new Set(argv);
	const expectedVersionFlag = argv.find((arg) => arg.startsWith("--expected-version="));
	return {
		expectedVersion: expectedVersionFlag ? expectedVersionFlag.split("=")[1] : undefined,
		binaryMode: args.has("--host-platform-binary-only")
			? "host"
			: args.has("--dev-release")
				? "none"
				: "all",
		smokeInstall: !args.has("--skip-smoke-install"),
	};
}

function readPackageVersion() {
	const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
	return packageJson.version;
}

function getDirectorySize(dir) {
	let size = 0;
	for (const file of readdirSync(dir)) {
		const path = join(dir, file);
		const stats = statSync(path);
		size += stats.isDirectory() ? getDirectorySize(path) : stats.size;
	}
	return size;
}

function validateBuildArtifacts({ logger, binaryMode, requireStableBinaries }) {
	const resolvedBinaryMode = resolveBinaryMode({ binaryMode, requireStableBinaries });
	const distDir = join(process.cwd(), "dist");
	const uiDir = join(distDir, "ui");
	const cliBundle = join(distDir, "index.js");
	const indexHtml = join(uiDir, "index.html");
	const requiredFiles = [
		{ path: cliBundle, label: "CLI bundle" },
		{ path: indexHtml, label: "UI bundle entry" },
		{ path: join(process.cwd(), "bin", "ck.js"), label: "Wrapper entry point" },
	];

	requiredFiles.push(...getRequiredBinaryArtifacts(resolvedBinaryMode));

	const errors = requiredFiles.filter((file) => !existsSync(file.path));
	if (errors.length > 0) {
		throw new Error(
			`Missing build artifacts: ${errors.map((file) => `${file.label} (${file.path})`).join(", ")}`,
		);
	}

	const cliSizeMB = (statSync(cliBundle).size / 1024 / 1024).toFixed(2);
	const uiSizeMB = (getDirectorySize(uiDir) / 1024 / 1024).toFixed(2);
	logger.log(`CLI bundle size: ${cliSizeMB}MB`);
	logger.log(`UI bundle size: ${uiSizeMB}MB`);
}

function packTarball() {
	const packDir = mkdtempSync(join(tmpdir(), "ck-pack-"));
	const packOutput = runCommandSync(
		getNpmCommand(),
		["pack", "--json", "--ignore-scripts", "--silent", "--pack-destination", packDir],
		{ encoding: "utf8" },
	);
	const parsedOutput = parseJsonCommandOutput(packOutput, "npm pack");
	if (!Array.isArray(parsedOutput) || parsedOutput.length === 0) {
		throw new Error(`npm pack returned an unexpected manifest payload:\n${packOutput.trim()}`);
	}
	const manifest = parsedOutput[0];
	return {
		manifest,
		packDir,
		tarballPath: join(packDir, manifest.filename),
	};
}

function verifyPackManifest({ logger, manifest, binaryMode, requireStableBinaries }) {
	const resolvedBinaryMode = resolveBinaryMode({ binaryMode, requireStableBinaries });
	const publishedPaths = new Set((manifest.files || []).map((file) => `package/${file.path}`));
	const requiredPaths = [...REQUIRED_PACK_FILES];
	requiredPaths.push(...getRequiredBinaryPackFiles(resolvedBinaryMode));

	const missingPaths = requiredPaths.filter((path) => !publishedPaths.has(path));
	if (missingPaths.length > 0) {
		throw new Error(
			`npm tarball is missing required files: ${missingPaths.join(", ")}.\n` +
				`Published files: ${Array.from(publishedPaths).sort().join(", ")}`,
		);
	}

	logger.log(`Verified npm tarball manifest (${manifest.entryCount} entries)`);
}

function createNodeOnlyPath() {
	const shimDir = mkdtempSync(join(tmpdir(), "ck-node-only-"));
	const nodeTarget = process.platform === "win32" ? "node.exe" : "node";
	const shimPath = join(shimDir, nodeTarget);

	if (process.platform === "win32") {
		copyFileSync(process.execPath, shimPath);
	} else {
		symlinkSync(process.execPath, shimPath);
	}

	return shimDir;
}

function verifyInstalledCli({ logger, tarballPath, expectedVersion }) {
	const installRoot = mkdtempSync(join(tmpdir(), "ck-install-"));
	const prefixDir = join(installRoot, "prefix");
	const nodeOnlyPath = createNodeOnlyPath();

	try {
		runCommandSync(
			getNpmCommand(),
			["install", "--global", "--prefix", prefixDir, "--no-audit", "--no-fund", tarballPath],
			{ encoding: "utf8" },
		);

		const cliPath =
			process.platform === "win32" ? join(prefixDir, "ck.cmd") : join(prefixDir, "bin", "ck");
		if (!existsSync(cliPath)) {
			throw new Error(`Installed CLI entry point not found at ${cliPath}`);
		}

		const env = {
			...process.env,
			PATH: nodeOnlyPath,
			NO_COLOR: "1",
		};
		const versionOutput = runCommandSync(cliPath, ["--version"], { encoding: "utf8", env });
		if (!versionOutput.includes(expectedVersion)) {
			throw new Error(
				`Installed CLI reported unexpected version.\nExpected: ${expectedVersion}\nReceived: ${versionOutput.trim()}`,
			);
		}

		const helpOutput = runCommandSync(cliPath, ["--help"], { encoding: "utf8", env });
		if (!helpOutput.includes("ClaudeKit CLI")) {
			throw new Error("Installed CLI help output did not contain the expected banner");
		}

		logger.log("Verified fresh Node-only install from packed tarball");
	} finally {
		rmSync(installRoot, { force: true, recursive: true });
		rmSync(nodeOnlyPath, { force: true, recursive: true });
	}
}

function verifyPackageReadyForPublish({
	logger = console,
	expectedVersion = readPackageVersion(),
	binaryMode,
	requireStableBinaries = true,
	smokeInstall = true,
} = {}) {
	const resolvedBinaryMode = resolveBinaryMode({ binaryMode, requireStableBinaries });
	validateBuildArtifacts({ logger, binaryMode: resolvedBinaryMode });
	const { manifest, packDir, tarballPath } = packTarball();

	try {
		verifyPackManifest({ logger, manifest, binaryMode: resolvedBinaryMode });
		if (smokeInstall) {
			verifyInstalledCli({ logger, tarballPath, expectedVersion });
		}
	} finally {
		rmSync(packDir, { force: true, recursive: true });
	}
}

const isDirectExecution =
	process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isDirectExecution) {
	try {
		const args = parseArgs(process.argv.slice(2));
		verifyPackageReadyForPublish(args);
		console.log("Pre-publish check passed!");
	} catch (error) {
		console.error("\nPre-publish check failed:\n");
		console.error(error instanceof Error ? error.message : String(error));
		process.exit(1);
	}
}

export { verifyPackageReadyForPublish };
