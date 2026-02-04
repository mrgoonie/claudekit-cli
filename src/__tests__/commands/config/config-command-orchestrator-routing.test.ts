/**
 * Tests for config command orchestrator
 */
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { configCommand } from "@/commands/config/config-command.js";
import type { ConfigCommandOptions } from "@/commands/config/types.js";

// Mock all handlers to avoid actual file operations
const mockConfigUICommand = mock(() => Promise.resolve());
const mockHandleGet = mock(() => Promise.resolve());
const mockHandleSet = mock(() => Promise.resolve());
const mockHandleShow = mock(() => Promise.resolve());

// Mock the handler modules
mock.module("@/commands/config/config-ui-command.js", () => ({
	configUICommand: mockConfigUICommand,
}));

mock.module("@/commands/config/phases/get-handler.js", () => ({
	handleGet: mockHandleGet,
}));

mock.module("@/commands/config/phases/set-handler.js", () => ({
	handleSet: mockHandleSet,
}));

mock.module("@/commands/config/phases/show-handler.js", () => ({
	handleShow: mockHandleShow,
}));

describe("configCommand", () => {
	beforeEach(() => {
		// Reset all mocks before each test
		mockConfigUICommand.mockClear();
		mockHandleGet.mockClear();
		mockHandleSet.mockClear();
		mockHandleShow.mockClear();
	});

	afterEach(() => {
		// Clean up process.exitCode
		process.exitCode = 0;
	});

	describe("default behavior (no action)", () => {
		it("launches dashboard when called with no arguments", async () => {
			await configCommand(undefined);
			expect(mockConfigUICommand).toHaveBeenCalledTimes(1);
			expect(mockConfigUICommand).toHaveBeenCalledWith({});
		});

		it("launches dashboard when called with options object as second param", async () => {
			const options = { port: 3000, noOpen: true } as unknown as ConfigCommandOptions;
			await configCommand(undefined, options);
			expect(mockConfigUICommand).toHaveBeenCalledTimes(1);
			expect(mockConfigUICommand).toHaveBeenCalledWith(options);
		});

		it("does not call other handlers when launching dashboard", async () => {
			await configCommand(undefined);
			expect(mockHandleGet).not.toHaveBeenCalled();
			expect(mockHandleSet).not.toHaveBeenCalled();
			expect(mockHandleShow).not.toHaveBeenCalled();
		});
	});

	describe("ui action", () => {
		it("calls configUICommand when action is 'ui'", async () => {
			await configCommand("ui");
			expect(mockConfigUICommand).toHaveBeenCalledTimes(1);
			expect(mockConfigUICommand).toHaveBeenCalledWith({});
		});

		it("passes options from second parameter when object", async () => {
			const options = { port: 3456, dev: true } as unknown as ConfigCommandOptions;
			await configCommand("ui", options);
			expect(mockConfigUICommand).toHaveBeenCalledWith(options);
		});

		it("passes options from fourth parameter when present", async () => {
			const options = { port: 4000, noOpen: true } as unknown as ConfigCommandOptions;
			await configCommand("ui", undefined, undefined, options);
			expect(mockConfigUICommand).toHaveBeenCalledWith(options);
		});

		it("prefers fourth parameter over second when both are objects", async () => {
			const opts2 = { port: 3000 } as unknown as ConfigCommandOptions;
			const opts4 = { port: 4000 } as unknown as ConfigCommandOptions;
			await configCommand("ui", opts2, undefined, opts4);
			expect(mockConfigUICommand).toHaveBeenCalledWith(opts4);
		});

		it("does not call other handlers", async () => {
			await configCommand("ui");
			expect(mockHandleGet).not.toHaveBeenCalled();
			expect(mockHandleSet).not.toHaveBeenCalled();
			expect(mockHandleShow).not.toHaveBeenCalled();
		});
	});

	describe("get action", () => {
		it("calls handleGet with key and empty options", async () => {
			await configCommand("get", "codingLevel");
			expect(mockHandleGet).toHaveBeenCalledTimes(1);
			expect(mockHandleGet).toHaveBeenCalledWith("codingLevel", {});
		});

		it("calls handleGet with key and options", async () => {
			const options = { global: true, json: true };
			await configCommand("get", "codingLevel", undefined, options);
			expect(mockHandleGet).toHaveBeenCalledWith("codingLevel", options);
		});

		it("does not call other handlers", async () => {
			await configCommand("get", "someKey");
			expect(mockConfigUICommand).not.toHaveBeenCalled();
			expect(mockHandleSet).not.toHaveBeenCalled();
			expect(mockHandleShow).not.toHaveBeenCalled();
		});

		it("handles nested key paths", async () => {
			await configCommand("get", "prompting.style");
			expect(mockHandleGet).toHaveBeenCalledWith("prompting.style", {});
		});
	});

	describe("set action", () => {
		it("calls handleSet with key, value, and empty options", async () => {
			await configCommand("set", "codingLevel", "senior");
			expect(mockHandleSet).toHaveBeenCalledTimes(1);
			expect(mockHandleSet).toHaveBeenCalledWith("codingLevel", "senior", {});
		});

		it("calls handleSet with key, value, and options", async () => {
			const options = { global: true };
			await configCommand("set", "codingLevel", "senior", options);
			expect(mockHandleSet).toHaveBeenCalledWith("codingLevel", "senior", options);
		});

		it("does not call other handlers", async () => {
			await configCommand("set", "someKey", "someValue");
			expect(mockConfigUICommand).not.toHaveBeenCalled();
			expect(mockHandleGet).not.toHaveBeenCalled();
			expect(mockHandleShow).not.toHaveBeenCalled();
		});

		it("sets exitCode to 1 when value is missing", async () => {
			const consoleSpy = mock(() => {});
			const originalError = console.error;
			console.error = consoleSpy;

			await configCommand("set", "someKey", undefined);

			console.error = originalError;

			expect(mockHandleSet).not.toHaveBeenCalled();
			expect(process.exitCode).toBe(1);
			expect(consoleSpy).toHaveBeenCalledWith("Usage: ck config set <key> <value>");
		});

		it("handles nested key paths", async () => {
			await configCommand("set", "prompting.style", "verbose");
			expect(mockHandleSet).toHaveBeenCalledWith("prompting.style", "verbose", {});
		});

		it("handles JSON values as strings", async () => {
			await configCommand("set", "myArray", '["a","b","c"]');
			expect(mockHandleSet).toHaveBeenCalledWith("myArray", '["a","b","c"]', {});
		});
	});

	describe("show action", () => {
		it("calls handleShow with empty options when no options provided", async () => {
			await configCommand("show");
			expect(mockHandleShow).toHaveBeenCalledTimes(1);
			expect(mockHandleShow).toHaveBeenCalledWith({});
		});

		it("calls handleShow with options from second parameter when object", async () => {
			const options = { json: true, global: true };
			await configCommand("show", options);
			expect(mockHandleShow).toHaveBeenCalledWith(options);
		});

		it("calls handleShow with options from fourth parameter", async () => {
			const options = { local: true };
			await configCommand("show", undefined, undefined, options);
			expect(mockHandleShow).toHaveBeenCalledWith(options);
		});

		it("does not call other handlers", async () => {
			await configCommand("show");
			expect(mockConfigUICommand).not.toHaveBeenCalled();
			expect(mockHandleGet).not.toHaveBeenCalled();
			expect(mockHandleSet).not.toHaveBeenCalled();
		});
	});

	describe("parameter routing logic", () => {
		it("routes to ui when first param is 'ui'", async () => {
			await configCommand("ui");
			expect(mockConfigUICommand).toHaveBeenCalled();
		});

		it("routes to get when first param is 'get' and second is string", async () => {
			await configCommand("get", "key");
			expect(mockHandleGet).toHaveBeenCalled();
		});

		it("routes to set when first param is 'set' and second/third are strings", async () => {
			await configCommand("set", "key", "value");
			expect(mockHandleSet).toHaveBeenCalled();
		});

		it("routes to show when first param is 'show'", async () => {
			await configCommand("show");
			expect(mockHandleShow).toHaveBeenCalled();
		});

		it("routes to dashboard (ui) when first param is undefined", async () => {
			await configCommand(undefined);
			expect(mockConfigUICommand).toHaveBeenCalled();
		});
	});

	describe("options handling", () => {
		it("extracts options from last parameter for get command", async () => {
			const options = { global: true, json: true };
			await configCommand("get", "myKey", undefined, options);
			expect(mockHandleGet).toHaveBeenCalledWith("myKey", options);
		});

		it("extracts options from last parameter for set command", async () => {
			const options = { local: true };
			await configCommand("set", "myKey", "myValue", options);
			expect(mockHandleSet).toHaveBeenCalledWith("myKey", "myValue", options);
		});

		it("defaults to empty object when no options provided", async () => {
			await configCommand("get", "myKey");
			expect(mockHandleGet).toHaveBeenCalledWith("myKey", {});

			mockHandleGet.mockClear();

			await configCommand("show");
			expect(mockHandleShow).toHaveBeenCalledWith({});
		});

		it("handles when second parameter is options object for show", async () => {
			const options = { json: true };
			await configCommand("show", options);
			expect(mockHandleShow).toHaveBeenCalledWith(options);
		});
	});

	describe("edge cases", () => {
		it("rejects empty string as key for get", async () => {
			await configCommand("get", "");
			expect(mockHandleGet).not.toHaveBeenCalled();
			expect(process.exitCode).toBe(1);
		});

		it("rejects empty string as key for set", async () => {
			await configCommand("set", "", "value");
			expect(mockHandleSet).not.toHaveBeenCalled();
			expect(process.exitCode).toBe(1);
		});

		it("handles empty string as value for set", async () => {
			await configCommand("set", "key", "");
			expect(mockHandleSet).toHaveBeenCalledWith("key", "", {});
		});

		it("handles special characters in key", async () => {
			await configCommand("get", "my-key.with_special@chars");
			expect(mockHandleGet).toHaveBeenCalledWith("my-key.with_special@chars", {});
		});

		it("handles numeric strings as keys", async () => {
			await configCommand("get", "123");
			expect(mockHandleGet).toHaveBeenCalledWith("123", {});
		});

		it("handles boolean-like strings as values", async () => {
			await configCommand("set", "enabled", "true");
			expect(mockHandleSet).toHaveBeenCalledWith("enabled", "true", {});
		});

		it("handles null-like strings as values", async () => {
			await configCommand("set", "value", "null");
			expect(mockHandleSet).toHaveBeenCalledWith("value", "null", {});
		});
	});

	describe("error scenarios", () => {
		it("shows usage message when set called without value", async () => {
			const consoleSpy = mock(() => {});
			const originalError = console.error;
			console.error = consoleSpy;

			await configCommand("set", "myKey", undefined);

			console.error = originalError;

			expect(mockHandleSet).not.toHaveBeenCalled();
			expect(consoleSpy).toHaveBeenCalledWith("Usage: ck config set <key> <value>");
			expect(process.exitCode).toBe(1);
		});

		it("shows usage when set value is an object instead of string", async () => {
			const consoleSpy = mock(() => {});
			const originalError = console.error;
			console.error = consoleSpy;

			const options = { global: true };
			await configCommand("set", "myKey", options);

			console.error = originalError;

			expect(mockHandleSet).not.toHaveBeenCalled();
			expect(consoleSpy).toHaveBeenCalled();
			expect(process.exitCode).toBe(1);
		});
	});
});
