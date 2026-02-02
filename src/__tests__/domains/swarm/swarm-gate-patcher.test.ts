/**
 * Tests for swarm gate detection and patching logic
 * Tests gate function detection, state detection, and patching operations
 */

import { describe, expect, test } from "bun:test";
import {
	detectSwarmModeState,
	findSwarmGateFunction,
	getSwarmGateInfo,
	patchSwarmGate,
} from "@/domains/swarm/index.js";

describe("swarm-gate-patcher", () => {
	describe("findSwarmGateFunction", () => {
		test("should find gate function with standard minified name", () => {
			const unpatched =
				'var x=1;function i8(){if(Yz(process.env.CLAUDE_CODE_AGENT_SWARMS))return!1;return xK("tengu_brass_pebble",!1)}var y=2;';
			const result = findSwarmGateFunction(unpatched);

			expect(result).not.toBeNull();
			expect(result?.fnName).toBe("i8");
			expect(result?.fullMatch).toBeDefined();
		});

		test("should find gate function with different minified name", () => {
			const unpatched =
				'var x=1;function a$(){if(Yz(process.env.CLAUDE_CODE_AGENT_SWARMS))return!1;return xK("tengu_brass_pebble",!1)}var y=2;';
			const result = findSwarmGateFunction(unpatched);

			expect(result).not.toBeNull();
			expect(result?.fnName).toBe("a$");
		});

		test("should find gate function with underscore prefix", () => {
			const unpatched =
				'function _foo(){if(Yz(process.env.CLAUDE_CODE_AGENT_SWARMS))return!1;return xK("tengu_brass_pebble",!1)}';
			const result = findSwarmGateFunction(unpatched);

			expect(result).not.toBeNull();
			expect(result?.fnName).toBe("_foo");
		});

		test("should return null when marker not present", () => {
			const old = "var x=1;function doStuff(){return!0}var y=2;";
			const result = findSwarmGateFunction(old);

			expect(result).toBeNull();
		});

		test("should return null when gate pattern not found", () => {
			const content =
				'var x=1;var marker="tengu_brass_pebble";function doStuff(){return!0}var y=2;';
			const result = findSwarmGateFunction(content);

			expect(result).toBeNull();
		});
	});

	describe("detectSwarmModeState", () => {
		test("should return 'disabled' for unpatched swarm-enabled CC", () => {
			const unpatched =
				'var x=1;function i8(){if(Yz(process.env.CLAUDE_CODE_AGENT_SWARMS))return!1;return xK("tengu_brass_pebble",!1)}var y=2;TeammateTool;teammate_mailbox;';
			const state = detectSwarmModeState(unpatched);

			expect(state).toBe("disabled");
		});

		test("should return 'enabled' for patched gate function", () => {
			// Marker must be present for enabled detection; patched function has no gate logic
			const patched =
				'var x=1;function i8(){return!0}var y=2;"tengu_brass_pebble";TeammateTool;teammate_mailbox;';
			const state = detectSwarmModeState(patched);

			expect(state).toBe("enabled");
		});

		test("should return 'unknown' for old CC without swarm code", () => {
			const old = "var x=1;function doStuff(){return!0}var y=2;";
			const state = detectSwarmModeState(old);

			expect(state).toBe("unknown");
		});

		test("should return 'enabled' when marker exists but gate is already patched", () => {
			const patched = 'var x=1;var marker="tengu_brass_pebble";function i8(){return!0}var y=2;';
			const state = detectSwarmModeState(patched);

			expect(state).toBe("enabled");
		});
	});

	describe("patchSwarmGate", () => {
		test("should transform disabled gate to enabled", () => {
			const unpatched =
				'var x=1;function i8(){if(Yz(process.env.CLAUDE_CODE_AGENT_SWARMS))return!1;return xK("tengu_brass_pebble",!1)}var y=2;';
			const result = patchSwarmGate(unpatched);

			expect(result.changed).toBe(true);
			expect(result.state).toBe("enabled");
			expect(result.content).toContain("function i8(){return!0}");
		});

		test("should preserve surrounding code after patch", () => {
			const unpatched =
				'var setup=1;function i8(){if(Yz(process.env.CLAUDE_CODE_AGENT_SWARMS))return!1;return xK("tengu_brass_pebble",!1)}var teardown=2;';
			const result = patchSwarmGate(unpatched);

			expect(result.content).toContain("var setup=1;");
			expect(result.content).toContain("var teardown=2;");
		});

		test("should be idempotent when already enabled", () => {
			// Marker must be present for enabled detection
			const patched = 'var x=1;function i8(){return!0}var y=2;"tengu_brass_pebble";TeammateTool;';
			const result = patchSwarmGate(patched);

			expect(result.changed).toBe(false);
			expect(result.state).toBe("enabled");
			expect(result.content).toBe(patched);
		});

		test("should not change unknown state", () => {
			const old = "var x=1;function doStuff(){return!0}var y=2;";
			const result = patchSwarmGate(old);

			expect(result.changed).toBe(false);
			expect(result.state).toBe("unknown");
			expect(result.content).toBe(old);
		});

		test("should use correct function name in replacement", () => {
			const unpatched =
				'function xyz123(){if(Yz(process.env.CLAUDE_CODE_AGENT_SWARMS))return!1;return xK("tengu_brass_pebble",!1)}';
			const result = patchSwarmGate(unpatched);

			expect(result.changed).toBe(true);
			expect(result.content).toContain("function xyz123(){return!0}");
			expect(result.content).not.toContain("function i8(){return!0}");
		});
	});

	describe("getSwarmGateInfo", () => {
		test("should return diagnostic info for disabled state", () => {
			const unpatched =
				'var x=1;function i8(){if(Yz(process.env.CLAUDE_CODE_AGENT_SWARMS))return!1;return xK("tengu_brass_pebble",!1)}var y=2;';
			const info = getSwarmGateInfo(unpatched);

			expect(info.state).toBe("disabled");
			expect(info.hasMarker).toBe(true);
			expect(info.hasGateFunction).toBe(true);
			expect(info.functionName).toBe("i8");
		});

		test("should return diagnostic info for enabled state", () => {
			// Marker must be present for enabled detection
			const patched = 'var x=1;function i8(){return!0}var y=2;"tengu_brass_pebble";TeammateTool;';
			const info = getSwarmGateInfo(patched);

			expect(info.state).toBe("enabled");
			expect(info.hasMarker).toBe(true);
			expect(info.hasGateFunction).toBe(false);
		});

		test("should return diagnostic info for unknown state", () => {
			const old = "var x=1;function doStuff(){return!0}var y=2;";
			const info = getSwarmGateInfo(old);

			expect(info.state).toBe("unknown");
			expect(info.hasMarker).toBe(false);
			expect(info.hasGateFunction).toBe(false);
			expect(info.functionName).toBeUndefined();
		});

		test("should detect marker even when gate pattern not found", () => {
			const content =
				'var x=1;var marker="tengu_brass_pebble";function doStuff(){return!0}var y=2;';
			const info = getSwarmGateInfo(content);

			expect(info.hasMarker).toBe(true);
			expect(info.hasGateFunction).toBe(false);
		});
	});
});
