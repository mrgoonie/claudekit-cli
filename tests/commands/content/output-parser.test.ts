import { describe, expect, test } from "bun:test";
import {
	extractContentFromResponse,
	parseClaudeJsonOutput,
} from "@/commands/content/phases/output-parser.js";

describe("Output Parser", () => {
	describe("parseClaudeJsonOutput", () => {
		test("should parse direct JSON", () => {
			const json = '{"text": "Hello world", "hashtags": ["test"]}';
			const result = parseClaudeJsonOutput(json) as any;
			expect(result).toEqual({ text: "Hello world", hashtags: ["test"] });
		});

		test("should parse JSON with extra whitespace", () => {
			const json = '  \n  {"text": "Hello"}\n  ';
			const result = parseClaudeJsonOutput(json) as any;
			expect(result).toEqual({ text: "Hello" });
		});

		test("should extract JSON from code block with language", () => {
			const input = `
Here's the generated content:

\`\`\`json
{"text": "Code block content", "hashtags": ["generated"]}
\`\`\`

Hope this helps!
			`;
			const result = parseClaudeJsonOutput(input) as any;
			expect(result).toEqual({ text: "Code block content", hashtags: ["generated"] });
		});

		test("should extract JSON from code block without language", () => {
			const input = `
\`\`\`
{"text": "No lang specified", "cta": "Click here"}
\`\`\`
			`;
			const result = parseClaudeJsonOutput(input) as any;
			expect(result).toEqual({ text: "No lang specified", cta: "Click here" });
		});

		test("should find JSON object embedded in text", () => {
			const input = `
Some preamble text about why this content is great.
{"text": "Embedded JSON", "hashtags": []}
More trailing text.
			`;
			const result = parseClaudeJsonOutput(input) as any;
			expect(result).toEqual({ text: "Embedded JSON", hashtags: [] });
		});

		test("should fallback to plain text when no JSON found", () => {
			const input = "This is just plain text response";
			const result = parseClaudeJsonOutput(input) as any;
			expect(result).toEqual({
				text: "This is just plain text response",
				hashtags: [],
				hook: "",
				cta: "",
			});
		});

		test("should fallback with multiline plain text", () => {
			const input = `
Line 1
Line 2
Line 3
			`;
			const result = parseClaudeJsonOutput(input) as any;
			expect(result.text).toContain("Line 1");
			expect(result.hashtags).toEqual([]);
		});

		test("should handle empty string", () => {
			const result = parseClaudeJsonOutput("") as any;
			expect(result).toEqual({ text: "", hashtags: [], hook: "", cta: "" });
		});

		test("should handle only whitespace", () => {
			const result = parseClaudeJsonOutput("   \n  \t  ") as any;
			expect(result).toEqual({ text: "", hashtags: [], hook: "", cta: "" });
		});

		test("should handle JSON with nested objects", () => {
			const json = '{"text": "test", "metadata": {"lang": "en", "version": 1}}';
			const result = parseClaudeJsonOutput(json) as any;
			expect(result).toBeDefined();
			expect(result.text).toBe("test");
		});

		test("should handle JSON with arrays", () => {
			const json = '{"text": "Hello", "hashtags": ["a", "b", "c"], "suggestions": [1, 2, 3]}';
			const result = parseClaudeJsonOutput(json) as any;
			expect(result.hashtags).toEqual(["a", "b", "c"]);
		});

		test("should prioritize direct JSON parse, then code block, then embedded", () => {
			// Direct JSON at the beginning
			const input1 = '{"text": "direct"}';
			const result1 = parseClaudeJsonOutput(input1) as any;
			expect(result1.text).toBe("direct");

			// Code block when direct JSON fails
			const input2 = 'Some text\n```json\n{"text": "code block"}\n```';
			const result2 = parseClaudeJsonOutput(input2) as any;
			expect(result2.text).toBe("code block");
		});

		test("should prioritize code block over embedded JSON", () => {
			const input = `
Before code
\`\`\`json
{"text": "in code block"}
\`\`\`
After code, but {"text": "embedded"} is here
			`;
			const result = parseClaudeJsonOutput(input) as any;
			expect(result.text).toBe("in code block");
		});

		test("should fallback to plain text when JSON extraction fails", () => {
			const input = `Text before code block
\`\`\`json
{invalid json here}
\`\`\`
Some text with no valid JSON`;
			const result = parseClaudeJsonOutput(input) as any;
			// All strategies fail, so fallback to plain text
			expect(result.text).toBe(input);
		});

		test("should handle malformed JSON everywhere and fallback to text", () => {
			const input = "{invalid} some text {more invalid}";
			const result = parseClaudeJsonOutput(input) as any;
			expect(result.text).toContain("some text");
		});
	});

	describe("extractContentFromResponse", () => {
		test("should extract all fields from complete object", () => {
			const response = {
				text: "Check out this feature",
				hashtags: ["ai", "coding"],
				hook: "Game-changer alert",
				cta: "Learn more",
				mediaPrompt: "A robot coding",
			};
			const result = extractContentFromResponse(response);
			expect(result.text).toBe("Check out this feature");
			expect(result.hashtags).toEqual(["ai", "coding"]);
			expect(result.hook).toBe("Game-changer alert");
			expect(result.cta).toBe("Learn more");
			expect(result.mediaPrompt).toBe("A robot coding");
		});

		test("should provide defaults for missing fields", () => {
			const response = { text: "Only text" };
			const result = extractContentFromResponse(response);
			expect(result.text).toBe("Only text");
			expect(result.hashtags).toEqual([]);
			expect(result.hook).toBe("");
			expect(result.cta).toBe("");
			expect(result.mediaPrompt).toBeUndefined();
		});

		test("should handle empty object", () => {
			const response = {};
			const result = extractContentFromResponse(response);
			expect(result.text).toBe("");
			expect(result.hashtags).toEqual([]);
			expect(result.hook).toBe("");
			expect(result.cta).toBe("");
		});

		test("should handle null input", () => {
			const result = extractContentFromResponse(null);
			// null becomes empty string in String() coercion with falsy check
			expect(result.text).toBe("");
			expect(result.hashtags).toEqual([]);
		});

		test("should handle undefined input", () => {
			const result = extractContentFromResponse(undefined);
			expect(result.text).toBe("");
			expect(result.hashtags).toEqual([]);
		});

		test("should handle string input by wrapping in defaults", () => {
			const result = extractContentFromResponse("just a string");
			expect(result.text).toBe("just a string");
			expect(result.hashtags).toEqual([]);
		});

		test("should handle number input", () => {
			const result = extractContentFromResponse(42);
			expect(result.text).toBe("42");
			expect(result.hashtags).toEqual([]);
		});

		test("should coerce hashtags array elements to strings", () => {
			const response = {
				text: "Content",
				hashtags: ["tag1", 2, true, null, undefined],
			};
			const result = extractContentFromResponse(response);
			expect(result.hashtags.length).toBe(5);
			expect(result.hashtags).toContain("tag1");
			expect(result.hashtags).toContain("2");
			expect(result.hashtags).toContain("true");
		});

		test("should handle non-array hashtags and use empty array", () => {
			const response = {
				text: "Content",
				hashtags: "not an array",
			};
			const result = extractContentFromResponse(response);
			expect(result.hashtags).toEqual([]);
		});

		test("should handle non-array hashtags that is null", () => {
			const response = {
				text: "Content",
				hashtags: null,
			};
			const result = extractContentFromResponse(response);
			expect(result.hashtags).toEqual([]);
		});

		test("should coerce all string fields", () => {
			const response = {
				text: 123,
				hook: ["should", "be", "string"],
				cta: { object: "value" },
			};
			const result = extractContentFromResponse(response);
			expect(typeof result.text).toBe("string");
			expect(typeof result.hook).toBe("string");
			expect(typeof result.cta).toBe("string");
		});

		test("should handle mediaPrompt as optional field", () => {
			const response1 = {
				text: "Test",
				mediaPrompt: undefined,
			};
			const result1 = extractContentFromResponse(response1);
			expect(result1.mediaPrompt).toBeUndefined();

			const response2 = {
				text: "Test",
				mediaPrompt: null,
			};
			const result2 = extractContentFromResponse(response2);
			expect(result2.mediaPrompt).toBeUndefined();

			const response3 = {
				text: "Test",
				mediaPrompt: "",
			};
			const result3 = extractContentFromResponse(response3);
			expect(result3.mediaPrompt).toBeUndefined();
		});

		test("should preserve mediaPrompt when non-empty", () => {
			const response = {
				text: "Test",
				mediaPrompt: "Vibrant illustration",
			};
			const result = extractContentFromResponse(response);
			expect(result.mediaPrompt).toBe("Vibrant illustration");
		});
	});

	describe("Integration: parseClaudeJsonOutput + extractContentFromResponse", () => {
		test("should work end-to-end with code block output", () => {
			const output = `
Here's the social media content:

\`\`\`json
{
  "text": "Excited to announce new AI features!",
  "hashtags": ["AI", "ClaudeKit"],
  "hook": "Game-changer incoming",
  "cta": "Check it out"
}
\`\`\`
			`;
			const parsed = parseClaudeJsonOutput(output);
			const extracted = extractContentFromResponse(parsed);

			expect(extracted.text).toBe("Excited to announce new AI features!");
			expect(extracted.hashtags).toEqual(["AI", "ClaudeKit"]);
			expect(extracted.hook).toBe("Game-changer incoming");
			expect(extracted.cta).toBe("Check it out");
		});

		test("should work end-to-end with plain text fallback", () => {
			const output = "This is just plain response text";
			const parsed = parseClaudeJsonOutput(output);
			const extracted = extractContentFromResponse(parsed);

			expect(extracted.text).toBe("This is just plain response text");
			expect(extracted.hashtags).toEqual([]);
		});
	});
});
