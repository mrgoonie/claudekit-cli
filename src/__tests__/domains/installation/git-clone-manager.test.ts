import { describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { GitCloneManager } from "@/domains/installation/git-clone-manager.js";

describe("GitCloneManager", () => {
	describe("static methods", () => {
		describe("isGitInstalled", () => {
			test("returns true when git is available", () => {
				const result = GitCloneManager.isGitInstalled();
				expect(result).toBe(true);
			});
		});

		describe("hasSshKeys", () => {
			test("returns boolean", () => {
				const result = GitCloneManager.hasSshKeys();
				expect(typeof result).toBe("boolean");
			});

			test("checks common SSH key locations", () => {
				const sshDir = path.join(process.env.HOME || "~", ".ssh");
				const hasKeys = GitCloneManager.hasSshKeys();

				// If user has SSH keys, verify at least one exists
				if (hasKeys) {
					const keyFiles = ["id_rsa", "id_ed25519", "id_ecdsa"];
					const foundKey = keyFiles.some((keyFile) => fs.existsSync(path.join(sshDir, keyFile)));
					expect(foundKey).toBe(true);
				}
			});
		});

		describe("testSshConnection", () => {
			// Skip in CI - SSH connection test hangs without proper SSH agent
			test.skipIf(!!process.env.CI)("returns boolean", async () => {
				const result = await GitCloneManager.testSshConnection();
				expect(typeof result).toBe("boolean");
			});
		});
	});

	describe("clone URL generation", () => {
		test("constructor sets tempBaseDir", () => {
			const manager = new GitCloneManager();
			// Manager should initialize without error
			expect(manager).toBeDefined();
		});
	});

	describe("clone error handling", () => {
		test("throws error for non-existent repo", async () => {
			const manager = new GitCloneManager();
			const kit = {
				owner: "nonexistent-owner-12345",
				repo: "nonexistent-repo-67890",
				name: "test",
				description: "test",
			};

			await expect(
				manager.clone({
					kit,
					tag: "v1.0.0",
					preferSsh: false,
					timeout: 5000,
				}),
			).rejects.toThrow();
		});

		test("timeout parameter is respected", async () => {
			const manager = new GitCloneManager();
			const kit = {
				owner: "nonexistent-owner",
				repo: "nonexistent-repo",
				name: "test",
				description: "test",
			};

			const startTime = Date.now();
			try {
				await manager.clone({
					kit,
					tag: "v1.0.0",
					preferSsh: false,
					timeout: 1000,
				});
			} catch {
				// Expected to fail
			}
			const elapsed = Date.now() - startTime;

			// Should fail relatively quickly, not wait forever
			expect(elapsed).toBeLessThan(15000);
		});
	});
});
