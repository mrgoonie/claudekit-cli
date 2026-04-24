/**
 * Isolated tmp-HOME factory for Playwright E2E specs.
 *
 * Creates a fresh temporary directory per test and seeds it with the
 * minimum filesystem structure the dashboard needs. Ensures the real
 * user $HOME is never touched during test execution.
 *
 * Usage:
 *   import { makeTmpHome } from "./tmp-home";
 *   const { homeDir, cleanup } = await makeTmpHome({ ... });
 *   // use homeDir as HOME env override
 *   await cleanup();
 *
 * Safety invariant: if the homeDir were to match the real os.homedir(),
 * this module throws rather than proceeding.
 */

import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Options controlling what directories and files are pre-seeded in
 * the tmp home. Providers maps a provider name (e.g. "codex", "claude")
 * to per-type directory states.
 */
export interface TmpHomeOptions {
	/**
	 * Registry to write at ~/.claudekit/portable-registry.json.
	 * Pass undefined to skip creating the registry (simulates fresh state).
	 */
	registry?: PortableRegistryV3 | null;

	/**
	 * Directories to pre-create under the provider root.
	 * Key: provider name ("codex", "claude", "agents").
	 * Value: per-type control. Use `empty: true` to create the dir but
	 * leave it empty; omit a key entirely to skip creating the dir.
	 */
	providerDirs?: ProviderDirSpec;

	/**
	 * Extra files to write verbatim. Key = path relative to homeDir.
	 * e.g. { ".claudekit/some-config.json": JSON.stringify({...}) }
	 */
	extraFiles?: Record<string, string>;
}

/** Per-provider, per-type directory spec */
export type ProviderDirSpec = Partial<Record<KnownProvider, ProviderTypeSpec>>;

/** Known provider root dirs relative to $HOME */
type KnownProvider = "codex" | "claude" | "agents";

/**
 * Portable type keys (plural, as used in discovery endpoints).
 * Controls whether a subdirectory is created and populated.
 */
type ProviderTypeSpec = Partial<
	Record<
		"hooks" | "agents" | "commands" | "rules" | "config" | "skills",
		{ empty: boolean; files?: SeedFile[] }
	>
>;

export interface SeedFile {
	name: string;
	content: string;
}

// ─── Registry types (minimal) ─────────────────────────────────────────────────

/** Subset of PortableRegistryV3 — enough for the tests to seed */
export interface PortableRegistryV3 {
	version: "3.0";
	installations: PortableInstallationV3[];
	lastReconciled?: string;
	appliedManifestVersion?: string;
}

export interface PortableInstallationV3 {
	item: string;
	type: "agent" | "command" | "skill" | "config" | "rules" | "hooks";
	provider: string;
	global: boolean;
	path: string;
	installedAt: string;
	sourcePath: string;
	cliVersion?: string;
	sourceChecksum: string;
	targetChecksum: string;
	installSource: "kit" | "manual";
	ownedSections?: string[];
}

// ─── Provider path helpers ────────────────────────────────────────────────────

/** Maps KnownProvider to the directory path relative to homeDir */
function providerRoot(homeDir: string, provider: KnownProvider): string {
	switch (provider) {
		case "codex":
			return join(homeDir, ".codex");
		case "claude":
			return join(homeDir, ".claude");
		case "agents":
			return join(homeDir, ".agents");
	}
}

/** Maps ProviderTypeSpec key to the subdirectory name under the provider root */
function typeSubdir(type: keyof ProviderTypeSpec): string {
	// Most type subdirs match the key; "agents" under .claude is just "agents"
	return type;
}

// ─── Safety guard ─────────────────────────────────────────────────────────────

const REAL_HOME = homedir();

function assertNotRealHome(dir: string): void {
	if (dir === REAL_HOME || dir.startsWith(`${REAL_HOME}/`)) {
		throw new Error(
			`[E2E safety] Refusing to write to real $HOME (${REAL_HOME}). makeTmpHome must always produce an isolated temp dir.`,
		);
	}
}

// ─── Core factory ─────────────────────────────────────────────────────────────

export interface TmpHome {
	/** Absolute path to use as HOME override */
	homeDir: string;
	/** Delete the temp dir and all contents */
	cleanup: () => Promise<void>;
}

/**
 * Creates an isolated tmpdir and pre-seeds it per options.
 * Always call cleanup() in test teardown (afterEach / using fixture).
 */
export async function makeTmpHome(opts: TmpHomeOptions = {}): Promise<TmpHome> {
	const homeDir = join(tmpdir(), `ck-e2e-${randomUUID()}`);
	assertNotRealHome(homeDir);

	// ── Base dirs ────────────────────────────────────────────────────────────
	await mkdir(homeDir, { recursive: true });
	await mkdir(join(homeDir, ".claudekit"), { recursive: true });

	// ── Registry ─────────────────────────────────────────────────────────────
	if (opts.registry !== undefined && opts.registry !== null) {
		const registryPath = join(homeDir, ".claudekit", "portable-registry.json");
		await writeFile(registryPath, JSON.stringify(opts.registry, null, 2), "utf-8");
	}
	// If registry is null/undefined, no file → server sees fresh state → suggestedMode=install

	// ── Provider dirs ─────────────────────────────────────────────────────────
	if (opts.providerDirs) {
		for (const [provider, typeSpec] of Object.entries(opts.providerDirs) as [
			KnownProvider,
			ProviderTypeSpec,
		][]) {
			const provRoot = providerRoot(homeDir, provider);
			await mkdir(provRoot, { recursive: true });

			if (typeSpec) {
				for (const [type, spec] of Object.entries(typeSpec) as [
					keyof ProviderTypeSpec,
					{ empty: boolean; files?: SeedFile[] },
				][]) {
					const typeDir = join(provRoot, typeSubdir(type));
					await mkdir(typeDir, { recursive: true });

					// If not empty, write seed files
					if (!spec.empty && spec.files && spec.files.length > 0) {
						for (const file of spec.files) {
							await writeFile(join(typeDir, file.name), file.content, "utf-8");
						}
					}
				}
			}
		}
	}

	// ── Extra files ───────────────────────────────────────────────────────────
	if (opts.extraFiles) {
		for (const [relPath, content] of Object.entries(opts.extraFiles)) {
			const fullPath = join(homeDir, relPath);
			await mkdir(join(fullPath, ".."), { recursive: true });
			await writeFile(fullPath, content, "utf-8");
		}
	}

	assertNotRealHome(homeDir); // Double-check before returning

	return {
		homeDir,
		cleanup: async () => {
			assertNotRealHome(homeDir);
			await rm(homeDir, { recursive: true, force: true });
		},
	};
}
