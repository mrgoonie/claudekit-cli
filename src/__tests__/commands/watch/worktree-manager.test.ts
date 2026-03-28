/**
 * Unit tests for worktree-manager.ts
 * Mocks spawnAndCollect from implementation-git-helpers and fs/promises
 */

import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import * as fs from "node:fs";
import * as fsPromises from "node:fs/promises";
import * as path from "node:path";
import * as gitHelpers from "../../../commands/watch/phases/implementation-git-helpers.js";
import {
	cleanupAllWorktrees,
	createWorktree,
	ensureGitignore,
	listActiveWorktrees,
	removeWorktree,
} from "../../../commands/watch/phases/worktree-manager.js";

const PROJECT_DIR = "/test/project";
const ISSUE_NUMBER = 42;
const BASE_BRANCH = "main";

describe("worktree-manager", () => {
	let spawnSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		spawnSpy = spyOn(gitHelpers, "spawnAndCollect").mockResolvedValue("");
	});

	afterEach(() => {
		mock.restore();
	});

	describe("createWorktree", () => {
		test("calls git worktree add with correct path and branch", async () => {
			const expectedPath = path.join(PROJECT_DIR, ".worktrees", `issue-${ISSUE_NUMBER}`);

			const result = await createWorktree(PROJECT_DIR, ISSUE_NUMBER, BASE_BRANCH);

			expect(result).toBe(expectedPath);

			// Should fetch first
			expect(spawnSpy).toHaveBeenCalledWith("git", ["fetch", "origin", BASE_BRANCH], PROJECT_DIR);

			// Should call worktree add with new branch
			expect(spawnSpy).toHaveBeenCalledWith(
				"git",
				[
					"worktree",
					"add",
					expectedPath,
					"-b",
					`ck-watch/issue-${ISSUE_NUMBER}`,
					`origin/${BASE_BRANCH}`,
				],
				PROJECT_DIR,
			);
		});

		test("retries with existing branch on first failure", async () => {
			const expectedPath = path.join(PROJECT_DIR, ".worktrees", `issue-${ISSUE_NUMBER}`);
			let callCount = 0;

			spawnSpy.mockImplementation(async (_cmd: string, args: string[]) => {
				// Fail the first worktree add attempt (new branch creation)
				if (args[0] === "worktree" && args[1] === "add" && args.includes("-b")) {
					callCount++;
					throw new Error("branch already exists");
				}
				return "";
			});

			const result = await createWorktree(PROJECT_DIR, ISSUE_NUMBER, BASE_BRANCH);

			expect(result).toBe(expectedPath);
			expect(callCount).toBe(1);

			// Should retry without -b flag (reuse existing branch)
			expect(spawnSpy).toHaveBeenCalledWith(
				"git",
				["worktree", "add", expectedPath, `ck-watch/issue-${ISSUE_NUMBER}`],
				PROJECT_DIR,
			);
		});

		test("throws descriptive error when both attempts fail", async () => {
			spawnSpy.mockImplementation(async (_cmd: string, args: string[]) => {
				if (args[0] === "worktree" && args[1] === "add") {
					throw new Error("git error");
				}
				return "";
			});

			await expect(createWorktree(PROJECT_DIR, ISSUE_NUMBER, BASE_BRANCH)).rejects.toThrow(
				`Failed to create worktree for issue #${ISSUE_NUMBER}`,
			);
		});
	});

	describe("removeWorktree", () => {
		test("calls git worktree remove --force with correct path", async () => {
			const expectedPath = path.join(PROJECT_DIR, ".worktrees", `issue-${ISSUE_NUMBER}`);

			await removeWorktree(PROJECT_DIR, ISSUE_NUMBER);

			expect(spawnSpy).toHaveBeenCalledWith(
				"git",
				["worktree", "remove", expectedPath, "--force"],
				PROJECT_DIR,
			);
		});

		test("also deletes the branch after removing worktree", async () => {
			await removeWorktree(PROJECT_DIR, ISSUE_NUMBER);

			expect(spawnSpy).toHaveBeenCalledWith(
				"git",
				["branch", "-D", `ck-watch/issue-${ISSUE_NUMBER}`],
				PROJECT_DIR,
			);
		});

		test("swallows worktree remove errors gracefully", async () => {
			spawnSpy.mockImplementation(async (_cmd: string, args: string[]) => {
				if (args[0] === "worktree" && args[1] === "remove") {
					throw new Error("worktree not found");
				}
				return "";
			});

			// Should not throw
			await expect(removeWorktree(PROJECT_DIR, ISSUE_NUMBER)).resolves.toBeUndefined();
		});
	});

	describe("listActiveWorktrees", () => {
		test("parses porcelain output and returns issue numbers", async () => {
			const projectNormalized = PROJECT_DIR.replace(/\\/g, "/");
			const porcelainOutput = [
				`worktree ${projectNormalized}`,
				"HEAD abc123",
				"branch refs/heads/main",
				"",
				`worktree ${projectNormalized}/.worktrees/issue-10`,
				"HEAD def456",
				"branch refs/heads/ck-watch/issue-10",
				"",
				`worktree ${projectNormalized}/.worktrees/issue-25`,
				"HEAD ghi789",
				"branch refs/heads/ck-watch/issue-25",
			].join("\n");

			spawnSpy.mockResolvedValue(porcelainOutput);

			const result = await listActiveWorktrees(PROJECT_DIR);

			expect(result).toContain(10);
			expect(result).toContain(25);
			expect(result).not.toContain(Number.NaN);
		});

		test("returns empty array on git command error", async () => {
			spawnSpy.mockRejectedValue(new Error("git not found"));

			const result = await listActiveWorktrees(PROJECT_DIR);

			expect(result).toEqual([]);
		});

		test("returns empty array when no ck-watch worktrees exist", async () => {
			const projectNormalized = PROJECT_DIR.replace(/\\/g, "/");
			spawnSpy.mockResolvedValue(
				`worktree ${projectNormalized}\nHEAD abc123\nbranch refs/heads/main\n`,
			);

			const result = await listActiveWorktrees(PROJECT_DIR);

			expect(result).toEqual([]);
		});
	});

	describe("cleanupAllWorktrees", () => {
		test("removes all listed worktrees sequentially", async () => {
			const projectNormalized = PROJECT_DIR.replace(/\\/g, "/");
			const porcelainOutput = [
				`worktree ${projectNormalized}/.worktrees/issue-1`,
				"",
				`worktree ${projectNormalized}/.worktrees/issue-2`,
			].join("\n");

			let listCallCount = 0;
			spawnSpy.mockImplementation(async (_cmd: string, args: string[]) => {
				if (args[0] === "worktree" && args[1] === "list") {
					listCallCount++;
					return porcelainOutput;
				}
				return "";
			});

			await cleanupAllWorktrees(PROJECT_DIR);

			expect(listCallCount).toBe(1);
			// Should have called remove for both issues
			expect(spawnSpy).toHaveBeenCalledWith(
				"git",
				["worktree", "remove", path.join(PROJECT_DIR, ".worktrees", "issue-1"), "--force"],
				PROJECT_DIR,
			);
			expect(spawnSpy).toHaveBeenCalledWith(
				"git",
				["worktree", "remove", path.join(PROJECT_DIR, ".worktrees", "issue-2"), "--force"],
				PROJECT_DIR,
			);
		});

		test("is no-op when no worktrees exist", async () => {
			const projectNormalized = PROJECT_DIR.replace(/\\/g, "/");
			spawnSpy.mockResolvedValue(
				`worktree ${projectNormalized}\nHEAD abc\nbranch refs/heads/main\n`,
			);

			await cleanupAllWorktrees(PROJECT_DIR);

			// Only list was called, no removes
			expect(spawnSpy).not.toHaveBeenCalledWith(
				"git",
				expect.arrayContaining(["worktree", "remove"]),
				PROJECT_DIR,
			);
		});
	});

	describe("ensureGitignore", () => {
		test("appends .worktrees/ when missing from .gitignore", async () => {
			spyOn(fs, "existsSync").mockReturnValue(true);
			spyOn(fsPromises, "readFile").mockResolvedValue("node_modules/\ndist/\n" as never);
			const writeSpy = spyOn(fsPromises, "writeFile").mockResolvedValue(undefined);

			await ensureGitignore(PROJECT_DIR);

			expect(writeSpy).toHaveBeenCalledWith(
				path.join(PROJECT_DIR, ".gitignore"),
				"node_modules/\ndist/\n.worktrees/\n",
				"utf-8",
			);
		});

		test("is no-op when .worktrees already in .gitignore", async () => {
			spyOn(fs, "existsSync").mockReturnValue(true);
			spyOn(fsPromises, "readFile").mockResolvedValue(
				"node_modules/\n.worktrees/\ndist/\n" as never,
			);
			const writeSpy = spyOn(fsPromises, "writeFile").mockResolvedValue(undefined);

			await ensureGitignore(PROJECT_DIR);

			expect(writeSpy).not.toHaveBeenCalled();
		});

		test("creates .gitignore when it does not exist", async () => {
			spyOn(fs, "existsSync").mockReturnValue(false);
			const writeSpy = spyOn(fsPromises, "writeFile").mockResolvedValue(undefined);

			await ensureGitignore(PROJECT_DIR);

			expect(writeSpy).toHaveBeenCalledWith(
				path.join(PROJECT_DIR, ".gitignore"),
				"\n.worktrees/\n",
				"utf-8",
			);
		});
	});
});
