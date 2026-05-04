import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { GitHubClient } from "@/domains/github/github-client.js";
import { detectAccessibleKits } from "@/domains/github/kit-access-checker.js";
import * as safeSpinner from "@/shared/safe-spinner.js";
import { GitHubError } from "@/types";
import { AVAILABLE_KITS } from "@/types";

/**
 * Build a fake Octokit-style error with an HTTP status code.
 * The `status` field is how `error-classifier.ts` identifies the failure class.
 */
function makeHttpError(status: number, message: string): Error & { status: number } {
	const err = new Error(message) as Error & { status: number };
	err.status = status;
	return err;
}

describe("kit-access-checker", () => {
	let mockSpinner: {
		start: ReturnType<typeof mock>;
		succeed: ReturnType<typeof mock>;
		fail: ReturnType<typeof mock>;
	};

	beforeEach(() => {
		// Mock spinner to avoid real terminal output during tests
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

	// -------------------------------------------------------------------------
	// PRESERVED BEHAVIOR: 404 = "no access" (not an error)
	// -------------------------------------------------------------------------

	describe("404 handling (preserved behavior)", () => {
		test("404 on one kit -> that kit excluded, no throw", async () => {
			const kitNames = Object.keys(AVAILABLE_KITS) as Array<keyof typeof AVAILABLE_KITS>;
			const [firstKit, ...rest] = kitNames;

			spyOn(GitHubClient.prototype, "checkAccess").mockImplementation(async (config) => {
				if (config.repo === AVAILABLE_KITS[firstKit].repo) {
					throw makeHttpError(404, "Not Found");
				}
				return true;
			});

			const result = await detectAccessibleKits();

			expect(result).not.toContain(firstKit);
			for (const k of rest) {
				expect(result).toContain(k);
			}
			// Must NOT throw — just exclude the kit
			expect(mockSpinner.succeed).toHaveBeenCalled();
		});

		test("404 on ALL kits -> empty array, no throw", async () => {
			spyOn(GitHubClient.prototype, "checkAccess").mockRejectedValue(
				makeHttpError(404, "Not Found"),
			);

			const result = await detectAccessibleKits();

			expect(result).toEqual([]);
			expect(mockSpinner.fail).toHaveBeenCalledWith("No kit access found");
		});
	});

	// -------------------------------------------------------------------------
	// NEW BEHAVIOR: Non-404 errors must propagate as GitHubError
	// -------------------------------------------------------------------------

	describe("NETWORK errors propagate", () => {
		test("ECONNREFUSED on any kit -> throws GitHubError with NETWORK message", async () => {
			const networkErr = new Error("connect ECONNREFUSED 140.82.121.4:443");
			spyOn(GitHubClient.prototype, "checkAccess").mockRejectedValue(networkErr);

			await expect(detectAccessibleKits()).rejects.toBeInstanceOf(GitHubError);
		});

		test("NETWORK error message contains 'Network connection error'", async () => {
			const networkErr = new Error("connect ECONNREFUSED 140.82.121.4:443");
			spyOn(GitHubClient.prototype, "checkAccess").mockRejectedValue(networkErr);

			let thrown: unknown;
			try {
				await detectAccessibleKits();
			} catch (e) {
				thrown = e;
			}
			expect(thrown).toBeInstanceOf(GitHubError);
			expect((thrown as GitHubError).message).toContain("Network connection error");
		});
	});

	describe("AUTH_MISSING (401) errors propagate", () => {
		test("401 on any kit -> throws GitHubError", async () => {
			// Simulate what handleHttpError produces for 401
			const authErr = new GitHubError("Not authenticated with GitHub", 401);
			spyOn(GitHubClient.prototype, "checkAccess").mockRejectedValue(authErr);

			await expect(detectAccessibleKits()).rejects.toBeInstanceOf(GitHubError);
		});

		test("401 error message references AUTH_MISSING text", async () => {
			const authErr = new GitHubError("Not authenticated with GitHub", 401);
			spyOn(GitHubClient.prototype, "checkAccess").mockRejectedValue(authErr);

			let thrown: unknown;
			try {
				await detectAccessibleKits();
			} catch (e) {
				thrown = e;
			}
			expect(thrown).toBeInstanceOf(GitHubError);
			// AUTH_MISSING category message from error-classifier.ts
			expect((thrown as GitHubError).message).toContain("Not authenticated with GitHub");
		});
	});

	describe("RATE_LIMIT (403 rate limit) errors propagate", () => {
		test("403 rate-limit on any kit -> throws GitHubError", async () => {
			const rateLimitErr = new GitHubError(
				"GitHub API rate limit exceeded\n\nRate limit will reset soon",
				403,
			);
			spyOn(GitHubClient.prototype, "checkAccess").mockRejectedValue(rateLimitErr);

			await expect(detectAccessibleKits()).rejects.toBeInstanceOf(GitHubError);
		});

		test("rate-limit error message mentions rate limit", async () => {
			const rateLimitErr = new GitHubError(
				"GitHub API rate limit exceeded\n\nRate limit will reset soon",
				403,
			);
			spyOn(GitHubClient.prototype, "checkAccess").mockRejectedValue(rateLimitErr);

			let thrown: unknown;
			try {
				await detectAccessibleKits();
			} catch (e) {
				thrown = e;
			}
			expect(thrown).toBeInstanceOf(GitHubError);
			expect((thrown as GitHubError).message).toContain("rate limit");
		});
	});

	describe("transport errors (synthetic 500 / fetch failed) propagate", () => {
		// Octokit's fetch-wrapper synthesizes a 500-status RequestError when fetch() itself
		// throws (DNS / ECONNRESET / TLS / proxy). By the time the error reaches
		// `kit-access-checker`, `checkAccess` has wrapped it via `handleHttpError` into a
		// GitHubError carrying the 500 status. We model that shape here.
		test("fetch failed (synthetic 500) -> throws GitHubError", async () => {
			spyOn(GitHubClient.prototype, "checkAccess").mockRejectedValue(
				makeHttpError(500, "fetch failed"),
			);

			await expect(detectAccessibleKits()).rejects.toBeInstanceOf(GitHubError);
		});

		test("ETIMEDOUT (synthetic 500) -> throws GitHubError", async () => {
			spyOn(GitHubClient.prototype, "checkAccess").mockRejectedValue(
				makeHttpError(500, "connect ETIMEDOUT"),
			);

			let thrown: unknown;
			try {
				await detectAccessibleKits();
			} catch (e) {
				thrown = e;
			}
			expect(thrown).toBeInstanceOf(GitHubError);
		});
	});

	describe("mixed errors: 404 + non-404", () => {
		test("one kit 404 + one kit NETWORK -> throws (non-404 wins)", async () => {
			const kitNames = Object.keys(AVAILABLE_KITS) as Array<keyof typeof AVAILABLE_KITS>;
			expect(kitNames.length).toBeGreaterThanOrEqual(2);

			const [kit404, kitNetwork] = kitNames;

			const networkErr = new Error("connect ECONNREFUSED 140.82.121.4:443");

			spyOn(GitHubClient.prototype, "checkAccess").mockImplementation(async (config) => {
				if (config.repo === AVAILABLE_KITS[kit404].repo) {
					throw makeHttpError(404, "Not Found");
				}
				if (config.repo === AVAILABLE_KITS[kitNetwork].repo) {
					throw networkErr;
				}
				return true;
			});

			// Should throw, not return empty array
			await expect(detectAccessibleKits()).rejects.toBeInstanceOf(GitHubError);
		});
	});

	// -------------------------------------------------------------------------
	// PRESERVED BEHAVIOR: spinner and parallel execution
	// -------------------------------------------------------------------------

	describe("happy path (all accessible)", () => {
		test("returns all kits when all are accessible", async () => {
			spyOn(GitHubClient.prototype, "checkAccess").mockResolvedValue(true);

			const result = await detectAccessibleKits();

			expect(result).toContain("engineer");
			expect(result).toContain("marketing");
			expect(result.length).toBe(Object.keys(AVAILABLE_KITS).length);
			expect(mockSpinner.succeed).toHaveBeenCalled();
		});

		test("spinner shows success message with accessible kits", async () => {
			spyOn(GitHubClient.prototype, "checkAccess").mockResolvedValue(true);

			await detectAccessibleKits();

			expect(mockSpinner.succeed).toHaveBeenCalledWith(expect.stringContaining("Access verified"));
		});

		test("checks all kits in parallel", async () => {
			const callOrder: string[] = [];
			spyOn(GitHubClient.prototype, "checkAccess").mockImplementation(async (config) => {
				callOrder.push(config.repo);
				await new Promise((r) => setTimeout(r, 10));
				return true;
			});

			await detectAccessibleKits();

			expect(callOrder.length).toBe(Object.keys(AVAILABLE_KITS).length);
		});

		test("shows spinner while checking", async () => {
			spyOn(GitHubClient.prototype, "checkAccess").mockResolvedValue(true);

			await detectAccessibleKits();

			expect(mockSpinner.start).toHaveBeenCalled();
		});
	});

	describe("partial access (one kit accessible)", () => {
		test("returns only engineer when marketing returns 404", async () => {
			spyOn(GitHubClient.prototype, "checkAccess").mockImplementation(async (config) => {
				if (config.repo === AVAILABLE_KITS.marketing.repo) {
					throw makeHttpError(404, "Not Found");
				}
				return true;
			});

			const result = await detectAccessibleKits();

			expect(result).toContain("engineer");
			expect(result).not.toContain("marketing");
			expect(result.length).toBe(1);
			expect(mockSpinner.succeed).toHaveBeenCalled();
		});

		test("returns only marketing when engineer returns 404", async () => {
			spyOn(GitHubClient.prototype, "checkAccess").mockImplementation(async (config) => {
				if (config.repo === AVAILABLE_KITS.engineer.repo) {
					throw makeHttpError(404, "Not Found");
				}
				return true;
			});

			const result = await detectAccessibleKits();

			expect(result).not.toContain("engineer");
			expect(result).toContain("marketing");
			expect(result.length).toBe(1);
			expect(mockSpinner.succeed).toHaveBeenCalled();
		});
	});
});
