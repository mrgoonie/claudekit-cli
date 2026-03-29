import { describe, expect, it } from "bun:test";
import { computeManagedSectionChecksums, parseMergedSections } from "../merge-single-sections.js";

describe("merge-single section helpers", () => {
	it("computes checksums using registry-compatible canonical section content", () => {
		const content = [
			"## Config",
			"",
			"First line",
			"",
			"---",
			"",
			"## Rule: development-rules",
			"",
			"Follow the rules.",
			"",
		].join("\n");

		const checksums = computeManagedSectionChecksums(content);

		expect(checksums["config:config"]).toBeDefined();
		expect(checksums["rule:development-rules"]).toBeDefined();
		expect(Object.keys(checksums)).toHaveLength(2);
	});

	it("preserves unknown sections while still parsing managed ones", () => {
		const parsed = parseMergedSections(
			[
				"# Preamble",
				"",
				"---",
				"",
				"## Rule: alpha",
				"",
				"Alpha body",
				"",
				"---",
				"",
				"## Custom",
				"",
				"User notes",
				"",
			].join("\n"),
		);

		expect(parsed.sections.map((section) => section.kind)).toEqual(["rule", "unknown"]);
		expect(parsed.preamble).toBe("# Preamble\n\n---");
	});
});
