/**
 * Tests for swarm skill installer
 * Tests skill installation, removal, and state detection
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	installSwarmSkill,
	isSwarmSkillInstalled,
	removeSwarmSkill,
} from "@/domains/swarm/index.js";

describe("swarm-skill-installer", () => {
	let testHome: string;

	beforeEach(() => {
		testHome = mkdtempSync(join(tmpdir(), "ck-skill-test-"));
		process.env.CK_TEST_HOME = testHome;
	});

	afterEach(() => {
		process.env.CK_TEST_HOME = undefined;
		if (existsSync(testHome)) {
			rmSync(testHome, { recursive: true, force: true });
		}
	});

	describe("installSwarmSkill", () => {
		test("should create skill directory structure", () => {
			installSwarmSkill();

			const skillDir = join(testHome, ".claude", "skills", "ck-swarm");
			expect(existsSync(skillDir)).toBe(true);
		});

		test("should install SKILL.md file", () => {
			installSwarmSkill();

			const skillFile = join(testHome, ".claude", "skills", "ck-swarm", "SKILL.md");
			expect(existsSync(skillFile)).toBe(true);
		});

		test("should install reference files", () => {
			installSwarmSkill();

			const refsDir = join(testHome, ".claude", "skills", "ck-swarm", "references");
			expect(existsSync(join(refsDir, "tools.md"))).toBe(true);
			expect(existsSync(join(refsDir, "patterns.md"))).toBe(true);
			expect(existsSync(join(refsDir, "examples.md"))).toBe(true);
		});

		test("should copy actual content to SKILL.md", () => {
			installSwarmSkill();

			const skillFile = join(testHome, ".claude", "skills", "ck-swarm", "SKILL.md");
			const content = readFileSync(skillFile, "utf-8");

			expect(content).toContain("ck-swarm");
			expect(content.length).toBeGreaterThan(100);
		});

		test("should be idempotent (safe to run twice)", () => {
			installSwarmSkill();
			installSwarmSkill();

			const skillFile = join(testHome, ".claude", "skills", "ck-swarm", "SKILL.md");
			expect(existsSync(skillFile)).toBe(true);
		});
	});

	describe("removeSwarmSkill", () => {
		test("should remove installed skill directory", () => {
			installSwarmSkill();

			const skillDir = join(testHome, ".claude", "skills", "ck-swarm");
			expect(existsSync(skillDir)).toBe(true);

			removeSwarmSkill();
			expect(existsSync(skillDir)).toBe(false);
		});

		test("should not throw when skill not installed", () => {
			expect(() => {
				removeSwarmSkill();
			}).not.toThrow();
		});

		test("should remove all reference files", () => {
			installSwarmSkill();
			removeSwarmSkill();

			const refsDir = join(testHome, ".claude", "skills", "ck-swarm", "references");
			expect(existsSync(refsDir)).toBe(false);
		});
	});

	describe("isSwarmSkillInstalled", () => {
		test("should return false when not installed", () => {
			expect(isSwarmSkillInstalled()).toBe(false);
		});

		test("should return true after installation", () => {
			installSwarmSkill();
			expect(isSwarmSkillInstalled()).toBe(true);
		});

		test("should return false after removal", () => {
			installSwarmSkill();
			removeSwarmSkill();
			expect(isSwarmSkillInstalled()).toBe(false);
		});
	});

	describe("Round-trip operations", () => {
		test("should support install-check-remove-check cycle", () => {
			expect(isSwarmSkillInstalled()).toBe(false);

			installSwarmSkill();
			expect(isSwarmSkillInstalled()).toBe(true);

			removeSwarmSkill();
			expect(isSwarmSkillInstalled()).toBe(false);
		});

		test("should support multiple install-remove cycles", () => {
			for (let i = 0; i < 3; i++) {
				installSwarmSkill();
				expect(isSwarmSkillInstalled()).toBe(true);

				removeSwarmSkill();
				expect(isSwarmSkillInstalled()).toBe(false);
			}
		});
	});
});
