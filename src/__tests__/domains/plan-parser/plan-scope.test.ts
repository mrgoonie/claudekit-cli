import { describe, expect, test } from "bun:test";
import {
	parsePlanReference,
	resolveGlobalPlansDir,
	resolvePlanDirForScope,
	resolveProjectPlansDir,
} from "@/domains/plan-parser/plan-scope.js";
import type { CkConfig } from "@/types";

describe("plan-scope", () => {
	const config: CkConfig = {
		paths: {
			plans: "plans/project",
			globalPlans: "plans/global",
		},
	};

	test("resolves project plans relative to project root", () => {
		expect(resolveProjectPlansDir("/repo", config)).toBe("/repo/plans/project");
	});

	test("resolves global plans relative to ~/.claude", () => {
		expect(resolveGlobalPlansDir(config)).toContain("/.claude/plans/global");
	});

	test("prefers absolute global plans path unchanged", () => {
		expect(
			resolveGlobalPlansDir({
				paths: {
					globalPlans: "/var/shared/plans",
				},
			}),
		).toBe("/var/shared/plans");
	});

	test("selects project directory for project scope", () => {
		expect(resolvePlanDirForScope("project", "/repo", config)).toBe("/repo/plans/project");
	});

	test("selects global directory for global scope", () => {
		expect(resolvePlanDirForScope("global", "/repo", config)).toContain("/.claude/plans/global");
	});

	test("parses explicit global references", () => {
		expect(parsePlanReference("global:260413-plan", "project")).toEqual({
			scope: "global",
			planId: "260413-plan",
			valid: true,
		});
	});

	test("parses explicit project references", () => {
		expect(parsePlanReference("project:260413-plan", "global")).toEqual({
			scope: "project",
			planId: "260413-plan",
			valid: true,
		});
	});

	test("keeps bare references in the default scope", () => {
		expect(parsePlanReference("260413-plan", "global")).toEqual({
			scope: "global",
			planId: "260413-plan",
			valid: true,
		});
	});

	test("rejects dependency references with traversal", () => {
		expect(parsePlanReference("global:../secret", "project")).toEqual({
			scope: "global",
			planId: "../secret",
			valid: false,
		});
	});

	test("rejects dependency references with nested separators", () => {
		expect(parsePlanReference("project:foo/bar", "global")).toEqual({
			scope: "project",
			planId: "foo/bar",
			valid: false,
		});
	});
});
