import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const workflow = readFileSync(".github/workflows/sync-dev-after-release.yml", "utf8");

describe("sync-dev-after-release workflow", () => {
	test("triggers after the Release workflow completes", () => {
		expect(workflow).toContain("workflow_run:");
		expect(workflow).toContain('workflows: ["Release"]');
		expect(workflow).toContain("types: [completed]");
	});

	test("merges main back into dev instead of resetting dev", () => {
		expect(workflow).toContain("git merge -X ours --no-ff origin/main");
		expect(workflow).not.toContain("git reset --hard origin/main");
		expect(workflow).not.toContain("git push origin dev --force");
	});

	test("uses a skip-ci merge commit to avoid an immediate dev prerelease", () => {
		expect(workflow).toContain("chore: merge main into dev [skip ci]");
	});
});
