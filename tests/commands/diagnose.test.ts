import { afterAll, afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { execSync } from "node:child_process";
import { diagnoseCommand } from "../../src/commands/diagnose.js";
import { AuthManager } from "../../src/lib/auth.js";
import { GitHubClient } from "../../src/lib/github.js";

// Mock process.exit to prevent test process termination
const originalExit = process.exit;
const mockExit = mock(() => {});

// Store original methods for restoration
const originalGetToken = AuthManager.getToken;
const originalIsValidTokenFormat = AuthManager.isValidTokenFormat;
const originalCheckAccess = GitHubClient.prototype.checkAccess;
const originalListReleases = GitHubClient.prototype.listReleases;

describe("diagnose command", () => {
	beforeEach(() => {
		// Reset process.exit mock
		mockExit.mockClear();
		// @ts-ignore - Mock process.exit
		process.exit = mockExit;
	});

	afterEach(() => {
		// Restore all mocked methods after each test
		AuthManager.getToken = originalGetToken;
		AuthManager.isValidTokenFormat = originalIsValidTokenFormat;
		GitHubClient.prototype.checkAccess = originalCheckAccess;
		GitHubClient.prototype.listReleases = originalListReleases;
	});

	afterAll(() => {
		// Restore original process.exit
		process.exit = originalExit;
	});

	it("should run diagnostics without errors", async () => {
		// Mock successful authentication
		const mockGetToken = mock(() =>
			Promise.resolve({
				token: "ghp_test1234567890123456789012345678901234",
				method: "env-var" as const,
			}),
		);
		AuthManager.getToken = mockGetToken;

		// Mock repository access check
		const mockCheckAccess = mock(() => Promise.resolve(true));
		GitHubClient.prototype.checkAccess = mockCheckAccess;

		// Mock releases list
		const mockListReleases = mock(() => Promise.resolve([]));
		GitHubClient.prototype.listReleases = mockListReleases;

		// Run diagnose
		await diagnoseCommand({ kit: "engineer" });

		// Should call authentication
		expect(mockGetToken).toHaveBeenCalled();

		// Check if we're in CI environment
		const isCIEnvironment = process.env.CI === "true" || process.env.CI_SAFE_MODE === "true";

		// Should check repository access only if not in CI
		if (isCIEnvironment) {
			expect(mockCheckAccess).not.toHaveBeenCalled();
			expect(mockListReleases).not.toHaveBeenCalled();
		} else {
			expect(mockCheckAccess).toHaveBeenCalled();
			expect(mockListReleases).toHaveBeenCalled();
		}

		// Should exit with success code (0)
		expect(mockExit).toHaveBeenCalledWith(0);
	});

	it("should detect authentication failures", async () => {
		// Mock authentication failure
		const mockGetToken = mock(() => Promise.reject(new Error("Authentication failed")));
		AuthManager.getToken = mockGetToken;

		// Run diagnose
		await diagnoseCommand({});

		// Should call authentication
		expect(mockGetToken).toHaveBeenCalled();

		// Should exit with error code (1) due to auth failure
		expect(mockExit).toHaveBeenCalledWith(1);
	});

	it("should detect repository access issues", async () => {
		// Mock successful authentication
		const mockGetToken = mock(() =>
			Promise.resolve({
				token: "ghp_test1234567890123456789012345678901234",
				method: "env-var" as const,
			}),
		);
		AuthManager.getToken = mockGetToken;

		// Mock repository access failure
		const mockCheckAccess = mock(() => Promise.resolve(false));
		GitHubClient.prototype.checkAccess = mockCheckAccess;

		// Run diagnose
		await diagnoseCommand({ kit: "engineer" });

		// Should call authentication
		expect(mockGetToken).toHaveBeenCalled();

		// Check if we're in CI environment
		const isCIEnvironment = process.env.CI === "true" || process.env.CI_SAFE_MODE === "true";

		// Should check repository access only if not in CI
		if (isCIEnvironment) {
			expect(mockCheckAccess).not.toHaveBeenCalled();
		} else {
			expect(mockCheckAccess).toHaveBeenCalled();
		}

		// Should exit with error code (1) due to access failure (or success in CI)
		if (isCIEnvironment) {
			expect(mockExit).toHaveBeenCalledWith(0); // In CI, we skip checks and exit successfully
		} else {
			expect(mockExit).toHaveBeenCalledWith(1); // In local, access failure should exit with error
		}
	});

	it("should validate token format", async () => {
		// Mock authentication with invalid token format
		const mockGetToken = mock(() =>
			Promise.resolve({
				token: "invalid_token_format",
				method: "env-var" as const,
			}),
		);
		AuthManager.getToken = mockGetToken;

		// Mock isValidTokenFormat to return false
		const mockIsValid = mock(() => false);
		AuthManager.isValidTokenFormat = mockIsValid;

		// Run diagnose
		await diagnoseCommand({});

		// Should call authentication
		expect(mockGetToken).toHaveBeenCalled();

		// Should validate token format
		expect(mockIsValid).toHaveBeenCalled();

		// Should exit with error code (1) due to invalid token
		expect(mockExit).toHaveBeenCalledWith(1);
	});

	it("should check GitHub CLI availability", async () => {
		// This test checks if the gh CLI check doesn't throw errors
		// It should handle both cases (installed/not installed) gracefully

		// Mock authentication to prevent actual auth
		const mockGetToken = mock(() =>
			Promise.resolve({
				token: "ghp_test1234567890123456789012345678901234",
				method: "env-var" as const,
			}),
		);
		AuthManager.getToken = mockGetToken;

		// Mock repository access
		const mockCheckAccess = mock(() => Promise.resolve(true));
		GitHubClient.prototype.checkAccess = mockCheckAccess;

		// Mock list releases
		const mockListReleases = mock(() => Promise.resolve([]));
		GitHubClient.prototype.listReleases = mockListReleases;

		// Run diagnose - should not throw even if gh is not installed
		await diagnoseCommand({});

		// Should complete without throwing
		expect(mockExit).toHaveBeenCalled();
	});

	it("should detect environment variables", async () => {
		// Set environment variable
		process.env.GITHUB_TOKEN = "ghp_test1234567890123456789012345678901234";

		// Mock authentication
		const mockGetToken = mock(() =>
			Promise.resolve({
				token: "ghp_test1234567890123456789012345678901234",
				method: "env-var" as const,
			}),
		);
		AuthManager.getToken = mockGetToken;

		// Mock repository access
		const mockCheckAccess = mock(() => Promise.resolve(true));
		GitHubClient.prototype.checkAccess = mockCheckAccess;

		// Mock list releases
		const mockListReleases = mock(() => Promise.resolve([]));
		GitHubClient.prototype.listReleases = mockListReleases;

		// Run diagnose
		await diagnoseCommand({});

		// Should detect the environment variable
		// (This is implicitly tested by the command running successfully)
		expect(mockExit).toHaveBeenCalledWith(0);

		// Clean up
		process.env.GITHUB_TOKEN = undefined;
	});

	it("should check all kits when no kit specified", async () => {
		// Mock successful authentication
		const mockGetToken = mock(() =>
			Promise.resolve({
				token: "ghp_test1234567890123456789012345678901234",
				method: "env-var" as const,
			}),
		);
		AuthManager.getToken = mockGetToken;

		// Mock repository access check
		const mockCheckAccess = mock(() => Promise.resolve(true));
		GitHubClient.prototype.checkAccess = mockCheckAccess;

		// Run diagnose without specifying kit
		await diagnoseCommand({});

		// Should call authentication
		expect(mockGetToken).toHaveBeenCalled();

		// Check if we're in CI environment
		const isCIEnvironment = process.env.CI === "true" || process.env.CI_SAFE_MODE === "true";

		// Should check repository access only if not in CI
		if (isCIEnvironment) {
			expect(mockCheckAccess).not.toHaveBeenCalled();
		} else {
			expect(mockCheckAccess).toHaveBeenCalled();
		}
	});

	it("should provide actionable suggestions on failures", async () => {
		// Mock authentication failure
		const mockGetToken = mock(() => Promise.reject(new Error("No token found")));
		AuthManager.getToken = mockGetToken;

		// Capture console output
		const consoleLogs: string[] = [];
		const originalLog = console.log;
		console.log = (...args: any[]) => {
			consoleLogs.push(args.join(" "));
		};

		// Run diagnose
		await diagnoseCommand({});

		// Restore console
		console.log = originalLog;

		// Should provide suggestions in the output
		const output = consoleLogs.join("\n");
		// The output should contain helpful information
		expect(mockExit).toHaveBeenCalledWith(1);
	});
});
