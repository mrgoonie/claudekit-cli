import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { trackPlanCreated } from "@/domains/plan-parser/plan-telemetry.js";

let originalTelemetry: string | undefined;
let originalWrite: typeof process.stderr.write;
let output = "";

beforeEach(() => {
	originalTelemetry = process.env.CK_TELEMETRY;
	originalWrite = process.stderr.write.bind(process.stderr) as typeof process.stderr.write;
	output = "";
	process.stderr.write = ((chunk: string | Uint8Array) => {
		output += String(chunk);
		return true;
	}) as typeof process.stderr.write;
});

afterEach(() => {
	process.stderr.write = originalWrite;
	if (originalTelemetry === undefined) {
		process.env.CK_TELEMETRY = undefined;
	} else {
		process.env.CK_TELEMETRY = originalTelemetry;
	}
});

describe("plan-telemetry", () => {
	test("stays silent when CK_TELEMETRY is disabled", () => {
		process.env.CK_TELEMETRY = undefined;
		trackPlanCreated("/tmp/demo", "cli");
		expect(output).toBe("");
	});

	test("writes debug output to stderr when CK_TELEMETRY=1", () => {
		process.env.CK_TELEMETRY = "1";
		trackPlanCreated("/tmp/demo", "cli");
		expect(output).toContain("[telemetry]");
		expect(output).toContain('"event":"plan_created"');
	});

	test("never throws if stderr logging fails", () => {
		process.env.CK_TELEMETRY = "1";
		process.stderr.write = (() => {
			throw new Error("stderr unavailable");
		}) as typeof process.stderr.write;

		expect(() => trackPlanCreated("/tmp/demo", "cli")).not.toThrow();
	});
});
