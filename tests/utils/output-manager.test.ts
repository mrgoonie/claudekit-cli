import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { output } from "../../src/shared/output-manager.js";

describe("OutputManager", () => {
	let consoleSpy: ReturnType<typeof mock>;
	let stderrSpy: ReturnType<typeof mock>;

	beforeEach(() => {
		output.reset();
		consoleSpy = mock(() => {});
		stderrSpy = mock(() => {});
		console.log = consoleSpy;
		console.error = stderrSpy;
	});

	afterEach(() => {
		output.reset();
	});

	describe("configure", () => {
		test("should set verbose mode", () => {
			output.configure({ verbose: true });
			expect(output.isVerbose()).toBe(true);
		});

		test("should set json mode", () => {
			output.configure({ json: true });
			expect(output.isJson()).toBe(true);
		});

		test("should set quiet mode", () => {
			output.configure({ quiet: true });
			expect(output.isQuiet()).toBe(true);
		});
	});

	describe("getSymbols", () => {
		test("should return symbols object with required keys", () => {
			const symbols = output.getSymbols();
			expect(symbols).toHaveProperty("prompt");
			expect(symbols).toHaveProperty("success");
			expect(symbols).toHaveProperty("error");
			expect(symbols).toHaveProperty("warning");
			expect(symbols).toHaveProperty("info");
			expect(symbols).toHaveProperty("line");
			expect(symbols).toHaveProperty("selected");
			expect(symbols).toHaveProperty("pointer");
		});
	});

	describe("output methods", () => {
		test("success should not output in quiet mode", () => {
			output.configure({ quiet: true });
			output.success("test message");
			expect(consoleSpy).not.toHaveBeenCalled();
		});

		test("error should still output in quiet mode (errors are critical)", () => {
			output.configure({ quiet: true });
			output.error("test error");
			expect(stderrSpy).toHaveBeenCalled();
		});

		test("warning should not output in quiet mode", () => {
			output.configure({ quiet: true });
			output.warning("test warning");
			expect(stderrSpy).not.toHaveBeenCalled();
		});

		test("info should not output in quiet mode", () => {
			output.configure({ quiet: true });
			output.info("test info");
			expect(consoleSpy).not.toHaveBeenCalled();
		});

		test("verbose should only output when verbose mode is enabled", () => {
			output.verbose("test verbose");
			expect(consoleSpy).not.toHaveBeenCalled();

			output.configure({ verbose: true });
			output.verbose("test verbose");
			expect(consoleSpy).toHaveBeenCalled();
		});
	});

	describe("JSON buffer", () => {
		test("should buffer JSON entries", () => {
			output.addJsonEntry({ type: "info", message: "test" });
			const buffer = output.getJsonBuffer();
			expect(buffer).toHaveLength(1);
			expect(buffer[0].type).toBe("info");
			expect(buffer[0].message).toBe("test");
			expect(buffer[0].timestamp).toBeDefined();
		});

		test("should add result data to buffer", () => {
			output.addJsonResult({ key: "value" });
			const buffer = output.getJsonBuffer();
			expect(buffer).toHaveLength(1);
			expect(buffer[0].type).toBe("result");
			expect(buffer[0].data).toEqual({ key: "value" });
		});

		test("should clear buffer", () => {
			output.addJsonEntry({ type: "info", message: "test" });
			output.clearJsonBuffer();
			expect(output.getJsonBuffer()).toHaveLength(0);
		});

		test("should flush buffer to stdout", async () => {
			output.addJsonEntry({ type: "info", message: "test" });
			await output.flushJson();
			expect(consoleSpy).toHaveBeenCalled();
			expect(output.getJsonBuffer()).toHaveLength(0);
		});

		test("should auto-flush at 1000 entries", async () => {
			for (let i = 0; i < 1000; i++) {
				output.addJsonEntry({ type: "progress", data: { i } });
			}
			// Auto-flush is deferred via queueMicrotask, wait for it
			await new Promise((resolve) => queueMicrotask(resolve));
			await output.flushJson(); // Ensure flush completes
			// Buffer should have been flushed and is now empty
			expect(output.getJsonBuffer()).toHaveLength(0);
			expect(consoleSpy).toHaveBeenCalled();
		});
	});

	describe("shouldShowProgress", () => {
		test("should return false in json mode", () => {
			output.configure({ json: true });
			expect(output.shouldShowProgress()).toBe(false);
		});

		test("should return false in quiet mode", () => {
			output.configure({ quiet: true });
			expect(output.shouldShowProgress()).toBe(false);
		});
	});

	describe("reset", () => {
		test("should reset all configuration", () => {
			output.configure({ verbose: true, json: true, quiet: true });
			output.addJsonEntry({ type: "info", message: "test" });
			output.reset();

			expect(output.isVerbose()).toBe(false);
			expect(output.isJson()).toBe(false);
			expect(output.isQuiet()).toBe(false);
			expect(output.getJsonBuffer()).toHaveLength(0);
		});
	});
});
