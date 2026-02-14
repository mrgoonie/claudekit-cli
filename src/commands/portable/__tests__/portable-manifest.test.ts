/**
 * Tests for portable-manifest.ts
 * Schema validation, path security, version filtering
 */
import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	type PortableManifest,
	type RenameEntry,
	getApplicableEntries,
	loadPortableManifest,
} from "../portable-manifest.js";

describe("loadPortableManifest", () => {
	test("loads valid manifest", async () => {
		const tmpDir = await mkdtemp(join(tmpdir(), "ck-manifest-test-"));

		const manifest: PortableManifest = {
			version: "1.0",
			cliVersion: "2.12.0",
			renames: [{ from: "skills/old-skill.md", to: "skills/new-skill.md", since: "2.11.0" }],
			providerPathMigrations: [],
			sectionRenames: [],
		};

		await writeFile(
			join(tmpDir, "portable-manifest.json"),
			JSON.stringify(manifest, null, 2),
			"utf-8",
		);

		const loaded = await loadPortableManifest(tmpDir);
		expect(loaded).not.toBeNull();
		expect(loaded?.version).toBe("1.0");
		expect(loaded?.renames.length).toBe(1);

		await rm(tmpDir, { recursive: true });
	});

	test("returns null on missing manifest", async () => {
		const tmpDir = await mkdtemp(join(tmpdir(), "ck-manifest-test-"));
		const loaded = await loadPortableManifest(tmpDir);
		expect(loaded).toBeNull();
		await rm(tmpDir, { recursive: true });
	});

	test("returns null on invalid JSON", async () => {
		const tmpDir = await mkdtemp(join(tmpdir(), "ck-manifest-test-"));
		await writeFile(join(tmpDir, "portable-manifest.json"), "not json", "utf-8");
		const loaded = await loadPortableManifest(tmpDir);
		expect(loaded).toBeNull();
		await rm(tmpDir, { recursive: true });
	});

	test("returns null on schema validation failure", async () => {
		const tmpDir = await mkdtemp(join(tmpdir(), "ck-manifest-test-"));

		const invalid = {
			version: "2.0", // Invalid version
			cliVersion: "2.12.0",
			renames: [],
		};

		await writeFile(join(tmpDir, "portable-manifest.json"), JSON.stringify(invalid), "utf-8");
		const loaded = await loadPortableManifest(tmpDir);
		expect(loaded).toBeNull();
		await rm(tmpDir, { recursive: true });
	});

	test("rejects path traversal in rename paths", async () => {
		const tmpDir = await mkdtemp(join(tmpdir(), "ck-manifest-test-"));

		const malicious = {
			version: "1.0",
			cliVersion: "2.12.0",
			renames: [{ from: "../etc/passwd", to: "skills/evil.md", since: "2.11.0" }],
			providerPathMigrations: [],
			sectionRenames: [],
		};

		await writeFile(join(tmpDir, "portable-manifest.json"), JSON.stringify(malicious), "utf-8");
		const loaded = await loadPortableManifest(tmpDir);
		expect(loaded).toBeNull(); // Schema validation should reject
		await rm(tmpDir, { recursive: true });
	});

	test("rejects absolute paths in rename paths", async () => {
		const tmpDir = await mkdtemp(join(tmpdir(), "ck-manifest-test-"));

		const malicious = {
			version: "1.0",
			cliVersion: "2.12.0",
			renames: [{ from: "/etc/passwd", to: "skills/evil.md", since: "2.11.0" }],
			providerPathMigrations: [],
			sectionRenames: [],
		};

		await writeFile(join(tmpDir, "portable-manifest.json"), JSON.stringify(malicious), "utf-8");
		const loaded = await loadPortableManifest(tmpDir);
		expect(loaded).toBeNull(); // Schema validation should reject
		await rm(tmpDir, { recursive: true });
	});

	test("rejects empty strings in rename paths", async () => {
		const tmpDir = await mkdtemp(join(tmpdir(), "ck-manifest-test-"));

		const invalid = {
			version: "1.0",
			cliVersion: "2.12.0",
			renames: [{ from: "", to: "skills/new.md", since: "2.11.0" }],
			providerPathMigrations: [],
			sectionRenames: [],
		};

		await writeFile(join(tmpDir, "portable-manifest.json"), JSON.stringify(invalid), "utf-8");
		const loaded = await loadPortableManifest(tmpDir);
		expect(loaded).toBeNull(); // Schema validation should reject empty path
		await rm(tmpDir, { recursive: true });
	});

	test("rejects path traversal in providerPathMigrations", async () => {
		const tmpDir = await mkdtemp(join(tmpdir(), "ck-manifest-test-"));

		const malicious = {
			version: "1.0",
			cliVersion: "2.12.0",
			renames: [],
			providerPathMigrations: [
				{
					provider: "codex",
					type: "skill",
					from: "../evil/",
					to: "safe/",
					since: "2.11.0",
				},
			],
			sectionRenames: [],
		};

		await writeFile(join(tmpDir, "portable-manifest.json"), JSON.stringify(malicious), "utf-8");
		const loaded = await loadPortableManifest(tmpDir);
		expect(loaded).toBeNull(); // Schema validation should reject
		await rm(tmpDir, { recursive: true });
	});

	test("rejects empty strings in sectionRenames", async () => {
		const tmpDir = await mkdtemp(join(tmpdir(), "ck-manifest-test-"));

		const invalid = {
			version: "1.0",
			cliVersion: "2.12.0",
			renames: [],
			providerPathMigrations: [],
			sectionRenames: [{ type: "skill", from: "", to: "new-section", since: "2.11.0" }],
		};

		await writeFile(join(tmpDir, "portable-manifest.json"), JSON.stringify(invalid), "utf-8");
		const loaded = await loadPortableManifest(tmpDir);
		expect(loaded).toBeNull(); // Schema validation should reject empty path
		await rm(tmpDir, { recursive: true });
	});

	test("allows unknown fields (passthrough)", async () => {
		const tmpDir = await mkdtemp(join(tmpdir(), "ck-manifest-test-"));

		const futureManifest = {
			version: "1.0",
			cliVersion: "2.12.0",
			renames: [],
			providerPathMigrations: [],
			sectionRenames: [],
			futureField: "some value", // Forward compatibility
		};

		await writeFile(
			join(tmpDir, "portable-manifest.json"),
			JSON.stringify(futureManifest),
			"utf-8",
		);
		const loaded = await loadPortableManifest(tmpDir);
		expect(loaded).not.toBeNull();
		expect(loaded?.version).toBe("1.0");
		await rm(tmpDir, { recursive: true });
	});
});

describe("getApplicableEntries", () => {
	const entries: RenameEntry[] = [
		{ from: "skills/a.md", to: "skills/a-new.md", since: "2.10.0" },
		{ from: "skills/b.md", to: "skills/b-new.md", since: "2.11.0" },
		{ from: "skills/c.md", to: "skills/c-new.md", since: "2.12.0" },
		{ from: "skills/d.md", to: "skills/d-new.md", since: "2.13.0" },
	];

	test("no applied version includes all entries up to current", () => {
		const applicable = getApplicableEntries(entries, undefined, "2.12.0");
		expect(applicable.length).toBe(3); // 2.10, 2.11, 2.12
		expect(applicable.map((e) => e.from)).toEqual(["skills/a.md", "skills/b.md", "skills/c.md"]);
	});

	test("applied version excludes older entries", () => {
		const applicable = getApplicableEntries(entries, "2.10.0", "2.12.0");
		expect(applicable.length).toBe(2); // 2.11, 2.12
		expect(applicable.map((e) => e.from)).toEqual(["skills/b.md", "skills/c.md"]);
	});

	test("same applied and current version excludes all", () => {
		const applicable = getApplicableEntries(entries, "2.12.0", "2.12.0");
		expect(applicable.length).toBe(0);
	});

	test("filters out future entries beyond current version", () => {
		const applicable = getApplicableEntries(entries, "2.10.0", "2.11.5");
		expect(applicable.length).toBe(1); // Only 2.11.0
		expect(applicable.map((e) => e.from)).toEqual(["skills/b.md"]);
	});

	test("handles invalid semver gracefully (includes entry)", () => {
		const badEntries = [{ from: "skills/x.md", to: "skills/x-new.md", since: "not-a-version" }];
		const applicable = getApplicableEntries(badEntries, "2.10.0", "2.12.0");
		expect(applicable.length).toBe(1); // Fail open
	});

	test("handles prerelease versions", () => {
		const preEntries = [{ from: "skills/p.md", to: "skills/p-new.md", since: "2.12.0-beta.1" }];
		const applicable = getApplicableEntries(preEntries, "2.11.0", "2.12.0");
		expect(applicable.length).toBe(1);
	});

	test("empty entries array returns empty", () => {
		const applicable = getApplicableEntries([], "2.10.0", "2.12.0");
		expect(applicable.length).toBe(0);
	});
});
