import { afterAll, beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SkillInfo } from "../../skills/types.js";

const addPortableInstallationMock = mock(async () => undefined);
const actualPortableRegistry = await import("../../portable/portable-registry.js");

mock.module("../../portable/portable-registry.js", () => ({
	...actualPortableRegistry,
	addPortableInstallation: addPortableInstallationMock,
}));

const { installSkillDirectories } = await import("../skill-directory-installer.js");

// Mock provider registry to use temp paths
const originalProviders = await import("../../portable/provider-registry.js").then(
	(m) => m.providers,
);

describe("installSkillDirectories", () => {
	const testDir = join(tmpdir(), `ck-skill-installer-test-${Date.now()}`);
	const sourceDir = join(testDir, "source");
	const targetDir = join(testDir, "target");

	beforeAll(() => {
		mkdirSync(join(sourceDir, "my-skill"), { recursive: true });
		writeFileSync(join(sourceDir, "my-skill", "SKILL.md"), "# My Skill\nTest content");
		writeFileSync(join(sourceDir, "my-skill", "script.sh"), "#!/bin/bash\necho hello");
	});

	beforeEach(() => {
		// Clean target between tests
		if (existsSync(targetDir)) {
			rmSync(targetDir, { recursive: true, force: true });
		}
		mkdirSync(targetDir, { recursive: true });
		addPortableInstallationMock.mockClear();
		addPortableInstallationMock.mockImplementation(async () => undefined);
	});

	afterAll(() => {
		rmSync(testDir, { recursive: true, force: true });
		mock.restore();
	});

	function makeSkill(name: string, path: string): SkillInfo {
		return { name, path, files: [] } as unknown as SkillInfo;
	}

	function patchSkillsPath(path: string | null) {
		const orig = originalProviders["claude-code"].skills;
		if (path === null) {
			originalProviders["claude-code"].skills = null;
		} else if (orig) {
			originalProviders["claude-code"].skills = { ...orig, projectPath: path };
		}
		return orig;
	}

	it("skips when source and target resolve to same path", async () => {
		const skill = makeSkill("my-skill", join(targetDir, "my-skill"));
		const origSkills = patchSkillsPath(targetDir);

		// Create existing dir at target so resolve matches
		mkdirSync(join(targetDir, "my-skill"), { recursive: true });

		const results = await installSkillDirectories([skill], ["claude-code"], { global: false });

		originalProviders["claude-code"].skills = origSkills;

		expect(results).toHaveLength(1);
		expect(results[0].skipped).toBe(true);
		expect(results[0].skipReason).toContain("Already at source");
	});

	it("reports overwrite warning when target exists", async () => {
		const skill = makeSkill("my-skill", join(sourceDir, "my-skill"));
		const origSkills = patchSkillsPath(targetDir);

		// Pre-create target directory
		mkdirSync(join(targetDir, "my-skill"), { recursive: true });
		writeFileSync(join(targetDir, "my-skill", "old-file.md"), "old content");

		const results = await installSkillDirectories([skill], ["claude-code"], { global: false });

		originalProviders["claude-code"].skills = origSkills;

		expect(results).toHaveLength(1);
		expect(results[0].success).toBe(true);
		expect(results[0].overwritten).toBe(true);
		expect(results[0].warnings).toBeDefined();
		expect(results[0].warnings?.[0]).toContain("Overwrote existing");
	});

	it("installs fresh skill without overwrite warning", async () => {
		const skill = makeSkill("my-skill", join(sourceDir, "my-skill"));
		const origSkills = patchSkillsPath(targetDir);

		const results = await installSkillDirectories([skill], ["claude-code"], { global: false });

		originalProviders["claude-code"].skills = origSkills;

		expect(results).toHaveLength(1);
		expect(results[0].success).toBe(true);
		expect(results[0].overwritten).toBeFalsy();
		expect(results[0].warnings).toBeUndefined();
		// Verify files were copied
		expect(existsSync(join(targetDir, "my-skill", "SKILL.md"))).toBe(true);
	});

	it("restores overwritten directory when registry update fails", async () => {
		const skill = makeSkill("my-skill", join(sourceDir, "my-skill"));
		const origSkills = patchSkillsPath(targetDir);
		const legacyFile = join(targetDir, "my-skill", "legacy.md");

		mkdirSync(join(targetDir, "my-skill"), { recursive: true });
		writeFileSync(legacyFile, "legacy content");
		addPortableInstallationMock.mockRejectedValueOnce(new Error("registry unavailable"));

		const results = await installSkillDirectories([skill], ["claude-code"], { global: false });

		originalProviders["claude-code"].skills = origSkills;

		expect(results).toHaveLength(1);
		expect(results[0].success).toBe(false);
		expect(results[0].error).toContain("registry unavailable");
		expect(existsSync(legacyFile)).toBe(true);
		expect(readFileSync(legacyFile, "utf-8")).toBe("legacy content");
		expect(existsSync(join(targetDir, "my-skill", "SKILL.md"))).toBe(false);
	});

	it("returns error for provider that does not support skills", async () => {
		const skill = makeSkill("my-skill", join(sourceDir, "my-skill"));
		const origSkills = patchSkillsPath(null);

		const results = await installSkillDirectories([skill], ["claude-code"], { global: false });

		originalProviders["claude-code"].skills = origSkills;

		expect(results).toHaveLength(1);
		expect(results[0].success).toBe(false);
		expect(results[0].error).toContain("does not support skills");
	});

	// Phase 04: verify installer reads paths from registry (no hardcoded strings)
	it("cursor: installs skill to path derived from registry (.cursor/skills/<name>)", async () => {
		const customPath = join(testDir, ".cursor", "skills");
		const skill = makeSkill("my-skill", join(sourceDir, "my-skill"));

		// Patch cursor provider to use testDir-relative path
		const origCursorSkills = originalProviders.cursor.skills;
		if (origCursorSkills) {
			originalProviders.cursor.skills = { ...origCursorSkills, projectPath: customPath };
		}

		const results = await installSkillDirectories([skill], ["cursor"], { global: false });

		originalProviders.cursor.skills = origCursorSkills;

		expect(results).toHaveLength(1);
		expect(results[0].success).toBe(true);
		// Path must come from registry-derived customPath, not any hardcoded string
		expect(results[0].path).toBe(join(customPath, "my-skill"));
		expect(existsSync(join(customPath, "my-skill", "SKILL.md"))).toBe(true);
		// addPortableInstallation called with correct targetDir from registry
		expect(addPortableInstallationMock).toHaveBeenCalledWith(
			"my-skill",
			"skill",
			"cursor",
			false,
			join(customPath, "my-skill"),
			expect.any(String),
		);
	});

	it("windsurf: installs skill to path derived from registry (.windsurf/skills/<name>)", async () => {
		const customPath = join(testDir, ".windsurf", "skills");
		const skill = makeSkill("my-skill", join(sourceDir, "my-skill"));

		// Patch windsurf provider to use testDir-relative path
		const origWindsurfSkills = originalProviders.windsurf.skills;
		if (origWindsurfSkills) {
			originalProviders.windsurf.skills = { ...origWindsurfSkills, projectPath: customPath };
		}

		const results = await installSkillDirectories([skill], ["windsurf"], { global: false });

		originalProviders.windsurf.skills = origWindsurfSkills;

		expect(results).toHaveLength(1);
		expect(results[0].success).toBe(true);
		// Path must come from registry-derived customPath, not any hardcoded string
		expect(results[0].path).toBe(join(customPath, "my-skill"));
		expect(existsSync(join(customPath, "my-skill", "SKILL.md"))).toBe(true);
		// addPortableInstallation called with correct targetDir from registry
		expect(addPortableInstallationMock).toHaveBeenCalledWith(
			"my-skill",
			"skill",
			"windsurf",
			false,
			join(customPath, "my-skill"),
			expect.any(String),
		);
	});

	it("windsurf global: installs skill to global path derived from registry", async () => {
		const globalCustomPath = join(testDir, ".codeium", "windsurf", "skills");
		const skill = makeSkill("my-skill", join(sourceDir, "my-skill"));

		// Patch windsurf provider global path
		const origWindsurfSkills = originalProviders.windsurf.skills;
		if (origWindsurfSkills) {
			originalProviders.windsurf.skills = {
				...origWindsurfSkills,
				globalPath: globalCustomPath,
			};
		}

		const results = await installSkillDirectories([skill], ["windsurf"], { global: true });

		originalProviders.windsurf.skills = origWindsurfSkills;

		expect(results).toHaveLength(1);
		expect(results[0].success).toBe(true);
		expect(results[0].path).toBe(join(globalCustomPath, "my-skill"));
		// addPortableInstallation called with isGlobal=true
		expect(addPortableInstallationMock).toHaveBeenCalledWith(
			"my-skill",
			"skill",
			"windsurf",
			true,
			join(globalCustomPath, "my-skill"),
			expect.any(String),
		);
	});
});
