import { describe, expect, test } from "bun:test";
import { resolveTargetFromBase } from "@/commands/plan/plan-scope-context.js";

describe("plan-scope-context", () => {
	test("resolves relative targets within the provided base", () => {
		expect(resolveTargetFromBase("260413-plan", "/tmp/global-plans")).toBe(
			"/tmp/global-plans/260413-plan",
		);
	});

	test("rejects traversal outside the provided base", () => {
		expect(resolveTargetFromBase("../outside", "/tmp/global-plans")).toBeNull();
	});

	test("rejects absolute paths outside the provided base", () => {
		expect(resolveTargetFromBase("/tmp/outside", "/tmp/global-plans")).toBeNull();
	});

	test("accepts absolute paths already inside the provided base", () => {
		expect(resolveTargetFromBase("/tmp/global-plans/260413-plan", "/tmp/global-plans")).toBe(
			"/tmp/global-plans/260413-plan",
		);
	});
});
