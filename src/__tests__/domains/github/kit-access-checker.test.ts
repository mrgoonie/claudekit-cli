import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { GitHubClient } from "@/domains/github/github-client.js";
import { detectAccessibleKits } from "@/domains/github/kit-access-checker.js";
import * as safeSpinner from "@/shared/safe-spinner.js";
import { AVAILABLE_KITS } from "@/types";

describe("kit-access-checker", () => {
	let mockSpinner: {
		start: ReturnType<typeof mock>;
		succeed: ReturnType<typeof mock>;
		fail: ReturnType<typeof mock>;
	};

	beforeEach(() => {
		// Mock spinner
		mockSpinner = {
			start: mock(() => mockSpinner),
			succeed: mock(() => mockSpinner),
			fail: mock(() => mockSpinner),
		};
		spyOn(safeSpinner, "createSpinner").mockReturnValue(mockSpinner as any);
	});

	afterEach(() => {
		mock.restore();
	});

	describe("detectAccessibleKits", () => {
		test("returns both kits when both are accessible", async () => {
			// Mock checkAccess to always succeed
			spyOn(GitHubClient.prototype, "checkAccess").mockResolvedValue(true);

			const result = await detectAccessibleKits();

			expect(result).toContain("engineer");
			expect(result).toContain("marketing");
			expect(result.length).toBe(2);
			expect(mockSpinner.succeed).toHaveBeenCalled();
		});

		test("returns only engineer when marketing fails", async () => {
			spyOn(GitHubClient.prototype, "checkAccess").mockImplementation(async (config) => {
				if (config.repo === "claudekit-marketing") {
					throw new Error("Access denied");
				}
				return true;
			});

			const result = await detectAccessibleKits();

			expect(result).toContain("engineer");
			expect(result).not.toContain("marketing");
			expect(result.length).toBe(1);
			expect(mockSpinner.succeed).toHaveBeenCalled();
		});

		test("returns only marketing when engineer fails", async () => {
			spyOn(GitHubClient.prototype, "checkAccess").mockImplementation(async (config) => {
				if (config.repo === "claudekit-engineer") {
					throw new Error("Access denied");
				}
				return true;
			});

			const result = await detectAccessibleKits();

			expect(result).not.toContain("engineer");
			expect(result).toContain("marketing");
			expect(result.length).toBe(1);
			expect(mockSpinner.succeed).toHaveBeenCalled();
		});

		test("returns empty array when no kits are accessible", async () => {
			spyOn(GitHubClient.prototype, "checkAccess").mockRejectedValue(new Error("Access denied"));

			const result = await detectAccessibleKits();

			expect(result).toEqual([]);
			expect(mockSpinner.fail).toHaveBeenCalled();
		});

		test("handles network errors gracefully", async () => {
			spyOn(GitHubClient.prototype, "checkAccess").mockRejectedValue(new Error("Network error"));

			const result = await detectAccessibleKits();

			expect(result).toEqual([]);
			expect(mockSpinner.fail).toHaveBeenCalled();
		});

		test("checks all kits in parallel", async () => {
			const callOrder: string[] = [];
			spyOn(GitHubClient.prototype, "checkAccess").mockImplementation(async (config) => {
				callOrder.push(config.repo);
				await new Promise((r) => setTimeout(r, 10)); // Simulate async delay
				return true;
			});

			await detectAccessibleKits();

			// Both should be called (parallel execution)
			expect(callOrder.length).toBe(Object.keys(AVAILABLE_KITS).length);
		});

		test("does not mutate results during concurrent execution", async () => {
			// Run multiple times to catch race conditions
			for (let i = 0; i < 10; i++) {
				spyOn(GitHubClient.prototype, "checkAccess").mockImplementation(async (config) => {
					await new Promise((r) => setTimeout(r, Math.random() * 20));
					if (config.repo === "claudekit-marketing") {
						throw new Error("Access denied");
					}
					return true;
				});

				const result = await detectAccessibleKits();

				// Should consistently return only engineer
				expect(result).toContain("engineer");
				expect(result).not.toContain("marketing");
				expect(result.length).toBe(1);

				mock.restore();
				mockSpinner = {
					start: mock(() => mockSpinner),
					succeed: mock(() => mockSpinner),
					fail: mock(() => mockSpinner),
				};
				spyOn(safeSpinner, "createSpinner").mockReturnValue(mockSpinner as any);
			}
		});

		test("shows spinner while checking", async () => {
			spyOn(GitHubClient.prototype, "checkAccess").mockResolvedValue(true);

			await detectAccessibleKits();

			expect(mockSpinner.start).toHaveBeenCalled();
		});

		test("spinner shows success message with accessible kits", async () => {
			spyOn(GitHubClient.prototype, "checkAccess").mockResolvedValue(true);

			await detectAccessibleKits();

			expect(mockSpinner.succeed).toHaveBeenCalledWith(expect.stringContaining("Access verified"));
		});

		test("spinner shows failure when no access", async () => {
			spyOn(GitHubClient.prototype, "checkAccess").mockRejectedValue(new Error("No access"));

			await detectAccessibleKits();

			expect(mockSpinner.fail).toHaveBeenCalledWith("No kit access found");
		});
	});
});
