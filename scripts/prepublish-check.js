#!/usr/bin/env node

import { execFileSync, spawn, spawnSync } from "node:child_process";
import {
	copyFileSync,
	existsSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	renameSync,
	rmSync,
	statSync,
	symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
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
const DASHBOARD_HOST = "127.0.0.1";
const DASHBOARD_STARTUP_TIMEOUT_MS = 30000;
const DASHBOARD_POLL_INTERVAL_MS = 250;

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

function readPackageName() {
	const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
	return packageJson.name;
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

function getInstalledPackageRoot(prefixDir) {
	const npmRoot = runCommandSync(getNpmCommand(), ["root", "--global", "--prefix", prefixDir], {
		encoding: "utf8",
	}).trim();
	const packageRoot = join(npmRoot, readPackageName());
	if (!existsSync(packageRoot)) {
		throw new Error(`Installed package root not found at ${packageRoot}`);
	}
	return packageRoot;
}

function getInstalledHostBinaryPath(packageRoot) {
	const packPath = PLATFORM_BINARY_PACK_FILES[getCurrentPlatformKey()];
	if (!packPath) {
		return null;
	}
	const binaryPath = join(packageRoot, packPath.replace(/^package[\\/]/, ""));
	if (!existsSync(binaryPath)) {
		throw new Error(`Installed host binary not found at ${binaryPath}`);
	}
	return binaryPath;
}

async function getAvailablePort() {
	const { createServer } = await import("node:net");

	return new Promise((resolve, reject) => {
		const server = createServer();
		server.once("error", reject);
		server.listen(0, DASHBOARD_HOST, () => {
			const address = server.address();
			const port =
				typeof address === "object" && address && "port" in address ? address.port : null;

			server.close((closeError) => {
				if (closeError) {
					reject(closeError);
					return;
				}

				if (typeof port !== "number") {
					reject(new Error("Failed to reserve an ephemeral dashboard port"));
					return;
				}

				resolve(port);
			});
		});
	});
}

function buildRuntimeEnv(overrides = {}) {
	return {
		...process.env,
		NO_COLOR: "1",
		NON_INTERACTIVE: "true",
		CI_SAFE_MODE: "true",
		...overrides,
	};
}

function formatProcessOutput(outputChunks) {
	const output = outputChunks.join("").trim();
	return output ? `\nProcess output:\n${output}` : "";
}

async function waitForDashboardReady(baseUrl, label, child, outputChunks, spawnErrorRef) {
	const deadline = Date.now() + DASHBOARD_STARTUP_TIMEOUT_MS;

	while (Date.now() < deadline) {
		if (spawnErrorRef.error) {
			throw new Error(`${label} failed to start: ${spawnErrorRef.error.message}`);
		}

		if (child.exitCode !== null) {
			throw new Error(
				`${label} exited before dashboard became ready (code ${child.exitCode}).${formatProcessOutput(
					outputChunks,
				)}`,
			);
		}

		try {
			const response = await fetch(`${baseUrl}/api/health`);
			if (response.ok) {
				return;
			}
		} catch {
			// Server not ready yet.
		}

		await delay(DASHBOARD_POLL_INTERVAL_MS);
	}

	throw new Error(
		`${label} did not become ready within ${DASHBOARD_STARTUP_TIMEOUT_MS}ms.${formatProcessOutput(
			outputChunks,
		)}`,
	);
}

async function assertDashboardServesAssets(baseUrl, label) {
	const indexResponse = await fetch(`${baseUrl}/`);
	if (!indexResponse.ok) {
		throw new Error(`${label} returned ${indexResponse.status} for GET /`);
	}

	const contentType = indexResponse.headers.get("content-type") ?? "";
	if (!contentType.includes("text/html")) {
		throw new Error(`${label} returned unexpected content type for GET /: ${contentType}`);
	}

	const html = await indexResponse.text();
	const assetMatches = Array.from(
		html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+\.(?:js|css))["']/g),
	);
	if (assetMatches.length === 0) {
		throw new Error(`${label} root HTML did not reference any hashed dashboard assets`);
	}

	const assetPath = assetMatches[0]?.[1];
	if (!assetPath) {
		throw new Error(`${label} HTML asset parsing returned an empty path`);
	}

	const assetResponse = await fetch(new URL(assetPath, `${baseUrl}/`));
	if (!assetResponse.ok) {
		throw new Error(`${label} returned ${assetResponse.status} for ${assetPath}`);
	}
}

async function waitForProcessExit(child, timeoutMs) {
	if (child.exitCode !== null) {
		return;
	}

	await new Promise((resolve) => {
		const timer = setTimeout(resolve, timeoutMs);
		child.once("exit", () => {
			clearTimeout(timer);
			resolve();
		});
	});
}

async function stopDashboardProcess(child) {
	if (child.exitCode !== null) {
		return;
	}

	if (process.platform === "win32") {
		child.kill();
		await waitForProcessExit(child, 2000);

		if (child.exitCode === null && child.pid) {
			try {
				runCommandSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
			} catch {
				// Best effort cleanup. The temp install directory is removed afterwards anyway.
			}
			await waitForProcessExit(child, 2000);
		}
		return;
	}

	child.kill("SIGTERM");
	await waitForProcessExit(child, 2000);

	if (child.exitCode === null) {
		child.kill("SIGKILL");
		await waitForProcessExit(child, 2000);
	}
}

async function smokeDashboardRuntime({ label, command, args, cwd, env }) {
	const port = await getAvailablePort();
	const baseUrl = `http://${DASHBOARD_HOST}:${port}`;
	const outputChunks = [];
	const spawnErrorRef = { error: null };
	const child = spawn(
		command,
		[...args, "config", "ui", "--no-open", "--host", DASHBOARD_HOST, "--port", String(port)],
		{
			cwd,
			env: buildRuntimeEnv(env),
			stdio: ["ignore", "pipe", "pipe"],
			windowsHide: true,
		},
	);

	child.stdout?.on("data", (chunk) => outputChunks.push(chunk.toString()));
	child.stderr?.on("data", (chunk) => outputChunks.push(chunk.toString()));
	child.once("error", (error) => {
		spawnErrorRef.error = error;
	});

	try {
		await waitForDashboardReady(baseUrl, label, child, outputChunks, spawnErrorRef);
		await assertDashboardServesAssets(baseUrl, label);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`${message}${formatProcessOutput(outputChunks)}`);
	} finally {
		await stopDashboardProcess(child);
	}
}

async function verifyInstalledCli({ logger, tarballPath, expectedVersion }) {
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

		const packageRoot = getInstalledPackageRoot(prefixDir);
		const installedDistPath = join(packageRoot, "dist", "index.js");
		if (!existsSync(installedDistPath)) {
			throw new Error(`Installed dist bundle not found at ${installedDistPath}`);
		}

		await smokeDashboardRuntime({
			label: "Installed packaged Bun runtime",
			command: "bun",
			args: [installedDistPath],
			cwd: installRoot,
		});
		logger.log("Verified packaged dashboard runtime via installed dist bundle");

		const installedUiDir = join(packageRoot, "dist", "ui");
		if (!existsSync(join(installedUiDir, "index.html"))) {
			throw new Error(`Installed dashboard UI not found at ${installedUiDir}`);
		}

		const installedHostBinaryPath = getInstalledHostBinaryPath(packageRoot);
		if (installedHostBinaryPath) {
			const hiddenUiDir = `${installedUiDir}.__hidden__`;
			renameSync(installedUiDir, hiddenUiDir);
			try {
				await smokeDashboardRuntime({
					label: "Installed packaged host binary",
					command: installedHostBinaryPath,
					args: [],
					cwd: installRoot,
				});
			} finally {
				if (existsSync(hiddenUiDir)) {
					renameSync(hiddenUiDir, installedUiDir);
				}
			}
			logger.log("Verified packaged host binary serves embedded dashboard assets");
		}

		logger.log("Verified fresh Node-only install entrypoint from packed tarball");
	} finally {
		rmSync(installRoot, { force: true, recursive: true });
		rmSync(nodeOnlyPath, { force: true, recursive: true });
	}
}

async function verifyPackageReadyForPublish({
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
			await verifyInstalledCli({ logger, tarballPath, expectedVersion });
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
		await verifyPackageReadyForPublish(args);
		console.log("Pre-publish check passed!");
	} catch (error) {
		console.error("\nPre-publish check failed:\n");
		console.error(error instanceof Error ? error.message : String(error));
		process.exit(1);
	}
}

export { verifyPackageReadyForPublish };
