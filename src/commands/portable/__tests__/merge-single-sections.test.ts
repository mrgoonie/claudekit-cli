import { describe, expect, it } from "bun:test";
import { computeContentChecksum } from "../checksum-utils.js";
import {
	buildMergeSectionContent,
	computeManagedSectionChecksums,
	parseMergedSections,
} from "../merge-single-sections.js";

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

	it("does not split config sections on internal markdown separators", () => {
		const content = [
			"## Config",
			"",
			"First line",
			"",
			"---",
			"",
			"## Inner Heading",
			"",
			"Still config",
			"",
			"---",
			"",
			"## Rule: alpha",
			"",
			"Alpha body",
			"",
		].join("\n");

		const parsed = parseMergedSections(content);
		const checksums = computeManagedSectionChecksums(content);

		expect(parsed.sections.map((section) => section.kind)).toEqual(["config", "rule"]);
		expect(parsed.sections[0]?.content).toContain("## Inner Heading");
		expect(checksums["config:config"]).toBe(
			computeContentChecksum(
				buildMergeSectionContent(
					"config",
					"config",
					"First line\n\n---\n\n## Inner Heading\n\nStill config",
				),
			),
		);
	});
});
