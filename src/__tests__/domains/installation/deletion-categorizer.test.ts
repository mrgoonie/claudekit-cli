import { describe, expect, test } from "bun:test";
import { categorizeDeletions } from "@/domains/installation/deletion-handler.js";

describe("categorizeDeletions", () => {
	test("categorizes commands as immediate", () => {
		const result = categorizeDeletions(["commands/old-cmd.md", "commands/fix/ci.md"]);
		expect(result.immediate).toEqual(["commands/old-cmd.md", "commands/fix/ci.md"]);
		expect(result.deferred).toEqual([]);
	});

	test("categorizes skills as deferred", () => {
		const result = categorizeDeletions(["skills/cook/**", "skills/debug/**"]);
		expect(result.deferred).toEqual(["skills/cook/**", "skills/debug/**"]);
		expect(result.immediate).toEqual([]);
	});

	test("splits mixed deletions correctly", () => {
		const result = categorizeDeletions([
			"commands/old.md",
			"skills/cook/**",
			"agents/old-agent/**",
			"skills/debug/**",
			"command-archive/fix/ci.md",
		]);
		expect(result.immediate).toEqual([
			"commands/old.md",
			"agents/old-agent/**",
			"command-archive/fix/ci.md",
		]);
		expect(result.deferred).toEqual(["skills/cook/**", "skills/debug/**"]);
	});

	test("handles empty array", () => {
		const result = categorizeDeletions([]);
		expect(result.immediate).toEqual([]);
		expect(result.deferred).toEqual([]);
	});

	test("handles Windows-style skill paths", () => {
		const result = categorizeDeletions(["skills\\cook\\**"]);
		expect(result.deferred).toEqual(["skills\\cook\\**"]);
		expect(result.immediate).toEqual([]);
	});
});
