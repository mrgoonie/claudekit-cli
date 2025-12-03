import { afterAll, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { diagnoseCommand } from "../../src/commands/diagnose.js";
import * as doctorModule from "../../src/commands/doctor.js";
import { logger } from "../../src/utils/logger.js";

/**
 * Tests for deprecated diagnose command
 *
 * The diagnose command now shows a deprecation warning and forwards
 * all requests to the doctor command. These tests verify:
 * 1. Deprecation warning is shown
 * 2. Command forwards to doctorCommand
 * 3. Existing behavior is maintained for backwards compatibility
 */

// Mock process.exit to prevent test process termination
const originalExit = process.exit;
const mockExit = mock(() => {});

describe("diagnose command (deprecated)", () => {
	let loggerWarningSpy: ReturnType<typeof spyOn>;
	let loggerInfoSpy: ReturnType<typeof spyOn>;
	let loggerVerboseSpy: ReturnType<typeof spyOn>;
	let doctorCommandSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		// Reset mocks
		mockExit.mockClear();
		// @ts-ignore - Mock process.exit
		process.exit = mockExit;

		// Spy on logger methods
		loggerWarningSpy = spyOn(logger, "warning");
		loggerInfoSpy = spyOn(logger, "info");
		loggerVerboseSpy = spyOn(logger, "verbose");

		// Spy on doctorCommand - mock to prevent actual execution
		doctorCommandSpy = spyOn(doctorModule, "doctorCommand").mockResolvedValue(undefined);

		// Set CI mode for non-interactive tests
		process.env.CI = "true";
	});

	afterAll(() => {
		// Restore original process.exit
		process.exit = originalExit;
	});

	it("shows deprecation warning", async () => {
		await diagnoseCommand({});

		// Should show deprecation warning
		expect(loggerWarningSpy).toHaveBeenCalledWith(expect.stringContaining("deprecated"));
	});

	it("suggests using ck doctor instead", async () => {
		await diagnoseCommand({});

		// Should suggest using doctor command
		expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining("ck doctor"));
	});

	it("logs forwarding to verbose output", async () => {
		await diagnoseCommand({ kit: "engineer" });

		// Should log forwarding action to verbose
		expect(loggerVerboseSpy).toHaveBeenCalledWith(
			expect.stringContaining("Forwarding"),
			expect.any(Object),
		);
	});

	it("forwards to doctorCommand", async () => {
		await diagnoseCommand({});

		// Should call doctorCommand
		expect(doctorCommandSpy).toHaveBeenCalled();
	});

	it("forwards with correct default options", async () => {
		await diagnoseCommand({});

		// Should pass default options to doctorCommand
		expect(doctorCommandSpy).toHaveBeenCalledWith({
			global: false,
			report: false,
			fix: false,
			checkOnly: false,
			json: false,
		});
	});

	it("accepts kit option for backwards compatibility", async () => {
		// Kit option is accepted but not used (for backwards compatibility)
		await diagnoseCommand({ kit: "engineer" });

		// Should still forward to doctorCommand
		expect(doctorCommandSpy).toHaveBeenCalled();
	});

	it("maintains backwards compatibility - no errors thrown", async () => {
		// Old users calling diagnoseCommand should not see errors
		// Just a warning and then normal doctor output

		// Should complete without throwing
		await diagnoseCommand({});
		expect(doctorCommandSpy).toHaveBeenCalled();
	});

	it("includes delay for users to see warning", async () => {
		const startTime = Date.now();
		await diagnoseCommand({});
		const duration = Date.now() - startTime;

		// Should have at least 1.5s delay (actual delay is 1500ms)
		// Allow some tolerance for test execution overhead
		expect(duration).toBeGreaterThanOrEqual(1400);
	});
});
