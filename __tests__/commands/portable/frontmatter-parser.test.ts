import { describe, expect, it } from "bun:test";
import { parseFrontmatter } from "../../../src/commands/portable/frontmatter-parser.js";

describe("parseFrontmatter", () => {
	it("parses valid frontmatter with name, description, tools, model fields", () => {
		const content = `---
name: Test Agent
description: A test description
tools: Read,Write,Bash
model: claude-3
---
Body content here.`;

		const result = parseFrontmatter(content);

		expect(result.frontmatter.name).toBe("Test Agent");
		expect(result.frontmatter.description).toBe("A test description");
		expect(result.frontmatter.tools).toBe("Read,Write,Bash");
		expect(result.frontmatter.model).toBe("claude-3");
		expect(result.body).toBe("Body content here.");
	});

	it("preserves extra frontmatter fields", () => {
		const content = `---
name: Agent
description: Desc
customField: customValue
anotherField: 123
---
Body.`;

		const result = parseFrontmatter(content);

		expect(result.frontmatter.name).toBe("Agent");
		expect(result.frontmatter.description).toBe("Desc");
		expect(result.frontmatter.customField).toBe("customValue");
		expect(result.frontmatter.anotherField).toBe(123);
		expect(result.body).toBe("Body.");
	});

	it("maps argument-hint to argumentHint", () => {
		const content = `---
name: Command
argument-hint: "<file>"
---
Body.`;

		const result = parseFrontmatter(content);

		expect(result.frontmatter.argumentHint).toBe("<file>");
		expect(result.frontmatter["argument-hint"]).toBeUndefined();
		expect(result.body).toBe("Body.");
	});

	it("handles content without frontmatter", () => {
		const content = "Just plain text content without any frontmatter.";

		const result = parseFrontmatter(content);

		expect(Object.keys(result.frontmatter).length).toBe(0);
		expect(result.body).toBe("Just plain text content without any frontmatter.");
	});

	it("handles malformed frontmatter by returning empty frontmatter", () => {
		const content = `---
name: Broken
invalid yaml: [unclosed
---
Body.`;

		const result = parseFrontmatter(content);

		// Should not throw, returns empty frontmatter and original content
		expect(Object.keys(result.frontmatter).length).toBe(0);
		expect(result.body.length).toBeGreaterThan(0);
	});

	it("handles empty content string", () => {
		const content = "";

		const result = parseFrontmatter(content);

		expect(Object.keys(result.frontmatter).length).toBe(0);
		expect(result.body).toBe("");
	});

	it("trims body content whitespace", () => {
		const content = `---
name: Agent
---


Body with extra newlines.


`;

		const result = parseFrontmatter(content);

		expect(result.frontmatter.name).toBe("Agent");
		expect(result.body).toBe("Body with extra newlines.");
	});

	it("converts all standard frontmatter fields to strings", () => {
		const content = `---
name: 123
description: "true"
model: 3.5
tools: "false"
memory: 1024
---
Body.`;

		const result = parseFrontmatter(content);

		expect(result.frontmatter.name).toBe("123");
		expect(result.frontmatter.description).toBe("true");
		expect(result.frontmatter.model).toBe("3.5");
		expect(result.frontmatter.tools).toBe("false");
		expect(result.frontmatter.memory).toBe("1024");
	});
});
