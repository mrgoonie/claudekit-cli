import { describe, expect, it } from "bun:test";
import { convertMdToMdc } from "../converters/md-to-mdc.js";
import type { PortableItem } from "../types.js";

function makeItem(body: string, overrides?: Partial<PortableItem>): PortableItem {
	return {
		name: "test-config",
		description: "",
		type: "config",
		sourcePath: "/test",
		frontmatter: {},
		body,
		...overrides,
	};
}

describe("convertMdToMdc", () => {
	it("generates valid MDC output with frontmatter markers", () => {
		const item = makeItem("# Test Content");
		const result = convertMdToMdc(item, "cursor");

		expect(result.content).toContain("---\n");
		expect(result.content).toContain("description:");
		expect(result.content).toContain("alwaysApply: true");
		expect(result.content.split("---").length).toBe(3); // Start marker, end marker, and content
	});

	it("strips Claude-specific references from body", () => {
		const item = makeItem("Use the Read tool to access files. The Grep tool helps search.");
		const result = convertMdToMdc(item, "cursor");

		expect(result.content).not.toContain("Read tool");
		expect(result.content).not.toContain("Grep tool");
		expect(result.content).toContain("file reading");
		expect(result.content).toContain("code search");
	});

	it("generates filename ending in .mdc", () => {
		const item = makeItem("# Test", { name: "my-config" });
		const result = convertMdToMdc(item, "cursor");

		expect(result.filename).toBe("my-config.mdc");
		expect(result.filename).toMatch(/\.mdc$/);
	});

	it("uses item description if provided", () => {
		const item = makeItem("# Test", {
			name: "test-config",
			description: "Custom description for this config",
		});
		const result = convertMdToMdc(item, "cursor");

		expect(result.content).toContain('description: "Custom description for this config"');
	});

	it("falls back to formatted name when no description", () => {
		const item = makeItem("# Test", {
			name: "my-test-config",
			description: "",
		});
		const result = convertMdToMdc(item, "cursor");

		expect(result.content).toContain('description: "My Test Config rules"');
	});

	it("escapes double quotes in description", () => {
		const item = makeItem("# Test", {
			name: "test-config",
			description: 'This has "quoted" text',
		});
		const result = convertMdToMdc(item, "cursor");

		expect(result.content).toContain('description: "This has \\"quoted\\" text"');
		expect(result.content).not.toContain('description: "This has "quoted" text"');
	});

	it("always sets alwaysApply to true", () => {
		const item1 = makeItem("# Test 1");
		const item2 = makeItem("# Test 2", { name: "another-config" });

		const result1 = convertMdToMdc(item1, "cursor");
		const result2 = convertMdToMdc(item2, "cursor");

		expect(result1.content).toContain("alwaysApply: true");
		expect(result2.content).toContain("alwaysApply: true");
	});

	it("preserves markdown formatting in body", () => {
		const item = makeItem(
			`
# Heading

- List item 1
- List item 2

\`\`\`typescript
const code = "example";
\`\`\`
    `.trim(),
		);
		const result = convertMdToMdc(item, "cursor");

		expect(result.content).toContain("# Heading");
		expect(result.content).toContain("- List item 1");
		expect(result.content).toContain("```typescript");
		expect(result.content).toContain('const code = "example";');
	});

	it("handles empty body gracefully", () => {
		const item = makeItem("");
		const result = convertMdToMdc(item, "cursor");

		expect(result.content).toContain("---");
		expect(result.content).toContain("alwaysApply: true");
		expect(result.filename).toBe("test-config.mdc");
	});

	it("handles special characters in name for filename", () => {
		const item = makeItem("# Test", { name: "config-with-special_chars" });
		const result = convertMdToMdc(item, "cursor");

		expect(result.filename).toBe("config-with-special_chars.mdc");
	});
});
