/**
 * Tests for content-transformer.ts
 *
 * Verifies that command references are properly transformed
 * when --prefix flag is used.
 */

import { describe, expect, it } from "bun:test";
import { transformCommandContent } from "@/services/transformers/commands-prefix/content-transformer.js";

describe("transformCommandContent", () => {
	describe("basic command transformations", () => {
		it("transforms /plan: to /ck:plan:", () => {
			const input = "Execute `/plan:fast` to create a plan";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe("Execute `/ck:plan:fast` to create a plan");
			expect(changes).toBe(1);
		});

		it("transforms /fix: to /ck:fix:", () => {
			const input = "Use `/fix:types` for TypeScript errors";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe("Use `/ck:fix:types` for TypeScript errors");
			expect(changes).toBe(1);
		});

		it("transforms /code: to /ck:code:", () => {
			const input = "Run `/code:auto` to implement";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe("Run `/ck:code:auto` to implement");
			expect(changes).toBe(1);
		});

		it("transforms /review: to /ck:review:", () => {
			const input = "Use `/review:codebase` for analysis";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe("Use `/ck:review:codebase` for analysis");
			expect(changes).toBe(1);
		});

		it("transforms /cook: to /ck:cook:", () => {
			const input = "Try `/cook:auto` for quick implementation";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe("Try `/ck:cook:auto` for quick implementation");
			expect(changes).toBe(1);
		});

		it("transforms /brainstorm to /ck:brainstorm", () => {
			const input = "Start with `/brainstorm` to explore options";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe("Start with `/ck:brainstorm` to explore options");
			expect(changes).toBe(1);
		});
	});

	describe("multiple transformations", () => {
		it("transforms multiple commands in same content", () => {
			const input = "Use `/plan:fast` then `/code:auto` then `/fix:types`";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe("Use `/ck:plan:fast` then `/ck:code:auto` then `/ck:fix:types`");
			expect(changes).toBe(3);
		});

		it("transforms commands across multiple lines", () => {
			const input = `1. Run /plan:hard
2. Execute /code:parallel
3. Verify with /review:codebase`;
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe(`1. Run /ck:plan:hard
2. Execute /ck:code:parallel
3. Verify with /ck:review:codebase`);
			expect(changes).toBe(3);
		});
	});

	describe("edge cases - should NOT transform", () => {
		it("does not transform URLs containing command-like paths", () => {
			const input = "Visit https://example.com/plan:something";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe(input);
			expect(changes).toBe(0);
		});

		it("does not transform already-prefixed commands", () => {
			const input = "Use `/ck:plan:fast` (already prefixed)";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe(input);
			expect(changes).toBe(0);
		});

		it("does not transform word boundaries incorrectly", () => {
			const input = "The planning process uses /plan:fast";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe("The planning process uses /ck:plan:fast");
			expect(changes).toBe(1);
		});

		it("does not transform partial matches in middle of words", () => {
			const input = "This is someplan:thing";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe(input);
			expect(changes).toBe(0);
		});
	});

	describe("context preservation", () => {
		it("preserves backtick wrapping", () => {
			const input = "Run ``/plan:fast`` command";
			const { transformed } = transformCommandContent(input);
			expect(transformed).toContain("/ck:plan:fast");
		});

		it("preserves markdown formatting", () => {
			const input = "**Important:** Use `/fix:hard` for complex issues";
			const { transformed } = transformCommandContent(input);
			expect(transformed).toBe("**Important:** Use `/ck:fix:hard` for complex issues");
		});

		it("handles commands at start of line", () => {
			const input = "/plan:fast is the command";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe("/ck:plan:fast is the command");
			expect(changes).toBe(1);
		});

		it("handles commands at end of line", () => {
			const input = "Use this command: /brainstorm";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe("Use this command: /ck:brainstorm");
			expect(changes).toBe(1);
		});
	});

	describe("real-world content examples", () => {
		it("transforms markdown file content", () => {
			const input = `## Workflow

- Decide to use \`/plan:fast\` or \`/plan:hard\` SlashCommands based on the complexity.
- Execute SlashCommand: \`/plan:fast <detailed-instructions-prompt>\` or \`/plan:hard <detailed-instructions-prompt>\``;

			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toContain("/ck:plan:fast");
			expect(transformed).toContain("/ck:plan:hard");
			expect(changes).toBe(4);
		});

		it("transforms agent definition content", () => {
			const input =
				"Use the **Skill tool** to invoke `/plan:fast` or `/plan:hard` SlashCommand based on complexity.";

			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe(
				"Use the **Skill tool** to invoke `/ck:plan:fast` or `/ck:plan:hard` SlashCommand based on complexity.",
			);
			expect(changes).toBe(2);
		});
	});

	describe("no changes needed", () => {
		it("returns 0 changes for content without commands", () => {
			const input = "This is regular content without any slash commands";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe(input);
			expect(changes).toBe(0);
		});

		it("returns 0 changes for empty content", () => {
			const input = "";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe("");
			expect(changes).toBe(0);
		});
	});
});
