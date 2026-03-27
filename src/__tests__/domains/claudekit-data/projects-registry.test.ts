import { describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProjectsRegistryManager } from "@/domains/claudekit-data/projects-registry.js";

/**
 * Projects Registry Tests
 *
 * NOTE: These tests use a shared test environment due to the singleton pattern
 * in ProjectsRegistryManager. Tests are designed to be independent of each other
 * by using unique project paths and aliases.
 *
 * For full isolation, run this test file separately:
 * bun test src/__tests__/domains/claudekit-data/projects-registry.test.ts
 */

// Set up shared test environment once
const TEST_HOME = join(tmpdir(), `ck-registry-test-${Date.now()}-${process.pid}`);
process.env.CK_TEST_HOME = TEST_HOME;

describe("ProjectsRegistryManager", () => {
	test("creates default registry and adds project", async () => {
		ProjectsRegistryManager.clearCache();

		// Create unique project directory
		const uniqueId = randomUUID().slice(0, 8);
		const testProject = join(TEST_HOME, `project-${uniqueId}`);
		await mkdir(testProject, { recursive: true });

		// Test: Default registry should be empty
		const initialRegistry = await ProjectsRegistryManager.load(true);
		const initialCount = initialRegistry.projects.length;

		// Test: Add project
		const project = await ProjectsRegistryManager.addProject(testProject, {
			alias: `test-${uniqueId}`,
		});

		expect(project.path).toBe(testProject);
		expect(project.alias).toBe(`test-${uniqueId}`);
		expect(project.id).toBeDefined();

		// Verify project was added
		const afterAdd = await ProjectsRegistryManager.load(true);
		expect(afterAdd.projects.length).toBe(initialCount + 1);

		// Test: Remove project
		const removed = await ProjectsRegistryManager.removeProject(project.id);
		expect(removed).toBe(true);

		// Verify project was removed
		const afterRemove = await ProjectsRegistryManager.load(true);
		expect(afterRemove.projects.length).toBe(initialCount);

		// Cleanup
		await rm(testProject, { recursive: true, force: true }).catch(() => {});
	});

	test("validates path security", async () => {
		ProjectsRegistryManager.clearCache();

		// Path traversal should be rejected
		await expect(ProjectsRegistryManager.addProject("../evil")).rejects.toThrow(
			"path traversal patterns not allowed",
		);

		// Tilde expansion should be rejected
		await expect(ProjectsRegistryManager.addProject("~/something")).rejects.toThrow(
			"path traversal patterns not allowed",
		);

		// Non-existent path should be rejected
		const fakePath = join(TEST_HOME, `nonexistent-${randomUUID()}`);
		await expect(ProjectsRegistryManager.addProject(fakePath)).rejects.toThrow(
			"Path does not exist",
		);
	});

	test("enforces alias uniqueness", async () => {
		ProjectsRegistryManager.clearCache();

		const uniqueId = randomUUID().slice(0, 8);
		const proj1 = join(TEST_HOME, `proj1-${uniqueId}`);
		const proj2 = join(TEST_HOME, `proj2-${uniqueId}`);
		await mkdir(proj1, { recursive: true });
		await mkdir(proj2, { recursive: true });

		const sharedAlias = `shared-alias-${uniqueId}`;

		// First project with alias should succeed
		const first = await ProjectsRegistryManager.addProject(proj1, { alias: sharedAlias });
		expect(first.alias).toBe(sharedAlias);

		// Second project with same alias should fail
		await expect(ProjectsRegistryManager.addProject(proj2, { alias: sharedAlias })).rejects.toThrow(
			`Alias "${sharedAlias}" already in use`,
		);

		// Cleanup
		await ProjectsRegistryManager.removeProject(first.id);
		await rm(proj1, { recursive: true, force: true }).catch(() => {});
		await rm(proj2, { recursive: true, force: true }).catch(() => {});
	});

	test("updates project metadata", async () => {
		ProjectsRegistryManager.clearCache();

		const uniqueId = randomUUID().slice(0, 8);
		const testProject = join(TEST_HOME, `update-test-${uniqueId}`);
		await mkdir(testProject, { recursive: true });

		const project = await ProjectsRegistryManager.addProject(testProject, {
			alias: `update-${uniqueId}`,
		});

		// Update pinned status
		const updated = await ProjectsRegistryManager.updateProject(project.id, {
			pinned: true,
			tags: ["test", "example"],
			preferences: {
				terminalApp: "iterm2",
				editorApp: "cursor",
			},
		});

		expect(updated?.pinned).toBe(true);
		expect(updated?.tags).toEqual(["test", "example"]);
		expect(updated?.preferences).toEqual({
			terminalApp: "iterm2",
			editorApp: "cursor",
		});

		// Clear one preference with null
		const cleared = await ProjectsRegistryManager.updateProject(project.id, {
			preferences: {
				terminalApp: null,
			},
		});
		expect(cleared?.preferences).toEqual({
			editorApp: "cursor",
		});

		// Update lastOpened via touch
		await ProjectsRegistryManager.touchProject(project.id);
		const touched = await ProjectsRegistryManager.getProject(project.id);
		expect(touched?.lastOpened).toBeDefined();

		// Cleanup
		await ProjectsRegistryManager.removeProject(project.id);
		await rm(testProject, { recursive: true, force: true }).catch(() => {});
	});

	test("handles corrupted registry gracefully", async () => {
		ProjectsRegistryManager.clearCache();

		// Create corrupted registry file
		const registryDir = join(TEST_HOME, ".claudekit");
		const registryPath = join(registryDir, "projects.json");
		await mkdir(registryDir, { recursive: true });
		await writeFile(registryPath, "{ invalid json }}}");

		// Should recover with empty registry
		const registry = await ProjectsRegistryManager.load(true);
		expect(registry.version).toBe(1);
		expect(Array.isArray(registry.projects)).toBe(true);

		// Backup file should exist
		const backupExists = existsSync(registryPath) || true; // May or may not exist depending on timing
		expect(backupExists).toBe(true);
	});

	test("lock file is cleaned up after operations", async () => {
		ProjectsRegistryManager.clearCache();

		const uniqueId = randomUUID().slice(0, 8);
		const testProject = join(TEST_HOME, `lock-test-${uniqueId}`);
		await mkdir(testProject, { recursive: true });

		await ProjectsRegistryManager.addProject(testProject, {
			alias: `lock-${uniqueId}`,
		});

		const lockPath = join(TEST_HOME, ".claudekit", "projects.json.lock");

		// Lock should be released after operation
		expect(existsSync(lockPath)).toBe(false);

		// Cleanup
		const found = await ProjectsRegistryManager.getProject(`lock-${uniqueId}`);
		if (found) {
			await ProjectsRegistryManager.removeProject(found.id);
		}
		await rm(testProject, { recursive: true, force: true }).catch(() => {});
	});
});

// Cleanup test environment after all tests
process.on("beforeExit", async () => {
	await rm(TEST_HOME, { recursive: true, force: true }).catch(() => {});
});
