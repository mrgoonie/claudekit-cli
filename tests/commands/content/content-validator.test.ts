import { describe, expect, test } from "bun:test";
import { validateContent } from "@/commands/content/phases/content-validator.js";
import type { GeneratedContent } from "@/commands/content/phases/output-parser.js";

describe("Content Validator", () => {
	const baseContent: GeneratedContent = {
		text: "This is valid social media content",
		hashtags: ["tag1", "tag2"],
		hook: "Check this out",
		cta: "Learn more",
	};

	describe("validateContent - Empty text", () => {
		test("should reject empty text", () => {
			const content: GeneratedContent = { ...baseContent, text: "" };
			const result = validateContent(content, "x");
			expect(result.valid).toBe(false);
			expect(result.issues).toContain("Content text is empty");
		});

		test("should reject whitespace-only text", () => {
			const content: GeneratedContent = { ...baseContent, text: "   \n  \t  " };
			const result = validateContent(content, "x");
			expect(result.valid).toBe(false);
			expect(result.issues[0]).toContain("empty");
		});

		test("should accept text with single character", () => {
			const content: GeneratedContent = { ...baseContent, text: "A" };
			const result = validateContent(content, "x");
			expect(result.valid).toBe(true);
			expect(result.issues).toHaveLength(0);
		});
	});

	describe("validateContent - Character limits", () => {
		test("should accept text under X limit (280 chars)", () => {
			const content: GeneratedContent = {
				...baseContent,
				text: "a".repeat(280),
			};
			const result = validateContent(content, "x");
			expect(result.valid).toBe(true);
		});

		test("should reject text over X limit (280 chars)", () => {
			const content: GeneratedContent = {
				...baseContent,
				text: "a".repeat(281),
			};
			const result = validateContent(content, "x");
			expect(result.valid).toBe(false);
			expect(result.issues.some((i) => i.includes("280"))).toBe(true);
		});

		test("should accept text exactly at X limit", () => {
			const content: GeneratedContent = {
				...baseContent,
				text: "a".repeat(280),
			};
			const result = validateContent(content, "x");
			expect(result.valid).toBe(true);
		});

		test("should accept text under Facebook limit (500 chars)", () => {
			const content: GeneratedContent = {
				...baseContent,
				text: "a".repeat(500),
			};
			const result = validateContent(content, "facebook");
			expect(result.valid).toBe(true);
		});

		test("should reject text over Facebook limit (500 chars)", () => {
			const content: GeneratedContent = {
				...baseContent,
				text: "a".repeat(501),
			};
			const result = validateContent(content, "facebook");
			expect(result.valid).toBe(false);
			expect(result.issues.some((i) => i.includes("500"))).toBe(true);
		});

		test("should accept text over 280 chars for x_thread", () => {
			const content: GeneratedContent = {
				...baseContent,
				text: "a".repeat(500),
			};
			const result = validateContent(content, "x_thread");
			expect(result.valid).toBe(true);
		});

		test("should not check char limit for x_thread (each part validated separately)", () => {
			const content: GeneratedContent = {
				...baseContent,
				text: "a".repeat(5000),
			};
			const result = validateContent(content, "x_thread");
			// Should not have char limit issue, but may have other issues
			expect(result.issues.some((i) => i.includes("char limit"))).toBe(false);
		});
	});

	describe("validateContent - Markdown detection", () => {
		test("should reject markdown headers", () => {
			const content: GeneratedContent = {
				...baseContent,
				text: "# This is a header",
			};
			const result = validateContent(content, "x");
			expect(result.valid).toBe(false);
			expect(result.issues.some((i) => i.includes("markdown"))).toBe(true);
		});

		test("should reject bold text", () => {
			const content: GeneratedContent = {
				...baseContent,
				text: "This is **bold** text",
			};
			const result = validateContent(content, "x");
			expect(result.valid).toBe(false);
			expect(result.issues.some((i) => i.includes("markdown"))).toBe(true);
		});

		test("should reject italic text", () => {
			const content: GeneratedContent = {
				...baseContent,
				text: "This is *italic* text",
			};
			const result = validateContent(content, "x");
			expect(result.valid).toBe(false);
			expect(result.issues.some((i) => i.includes("markdown"))).toBe(true);
		});

		test("should reject list items", () => {
			const content: GeneratedContent = {
				...baseContent,
				text: "- List item 1\n- List item 2",
			};
			const result = validateContent(content, "x");
			expect(result.valid).toBe(false);
			expect(result.issues.some((i) => i.includes("markdown"))).toBe(true);
		});

		test("should reject inline code", () => {
			const content: GeneratedContent = {
				...baseContent,
				text: "Use `console.log()` for debugging",
			};
			const result = validateContent(content, "x");
			expect(result.valid).toBe(false);
			expect(result.issues.some((i) => i.includes("markdown"))).toBe(true);
		});

		test("should reject markdown links", () => {
			const content: GeneratedContent = {
				...baseContent,
				text: "Check out [this guide](https://example.com)",
			};
			const result = validateContent(content, "x");
			expect(result.valid).toBe(false);
			expect(result.issues.some((i) => i.includes("markdown"))).toBe(true);
		});

		test("should only report markdown once even if multiple markers", () => {
			const content: GeneratedContent = {
				...baseContent,
				text: "# Header with **bold** and *italic*",
			};
			const result = validateContent(content, "x");
			const markdownIssues = result.issues.filter((i) => i.includes("markdown"));
			expect(markdownIssues).toHaveLength(1);
		});
	});

	describe("validateContent - AI phrase detection", () => {
		test("should reject 'as an ai' phrase", () => {
			const content: GeneratedContent = {
				...baseContent,
				text: "As an AI, I can help you with this",
			};
			const result = validateContent(content, "x");
			expect(result.valid).toBe(false);
			expect(result.issues.some((i) => i.includes("AI-sounding phrase"))).toBe(true);
		});

		test("should reject 'i'd be happy to'", () => {
			const content: GeneratedContent = {
				...baseContent,
				text: "I'd be happy to assist",
			};
			const result = validateContent(content, "x");
			expect(result.valid).toBe(false);
		});

		test("should reject 'certainly'", () => {
			const content: GeneratedContent = {
				...baseContent,
				text: "Certainly! Here's what you need to know.",
			};
			const result = validateContent(content, "x");
			expect(result.valid).toBe(false);
		});

		test("should reject 'i cannot'", () => {
			const content: GeneratedContent = {
				...baseContent,
				text: "I cannot provide that information",
			};
			const result = validateContent(content, "x");
			expect(result.valid).toBe(false);
		});

		test("should reject 'delve into'", () => {
			const content: GeneratedContent = {
				...baseContent,
				text: "Let's delve into the details of this feature",
			};
			const result = validateContent(content, "x");
			expect(result.valid).toBe(false);
		});

		test("should reject 'game-changer'", () => {
			const content: GeneratedContent = {
				...baseContent,
				text: "This is a game-changer for the industry",
			};
			const result = validateContent(content, "x");
			expect(result.valid).toBe(false);
		});

		test("should reject 'leverage'", () => {
			const content: GeneratedContent = {
				...baseContent,
				text: "We can leverage this to improve results",
			};
			const result = validateContent(content, "x");
			expect(result.valid).toBe(false);
		});

		test("should be case-insensitive for AI phrases", () => {
			const content: GeneratedContent = {
				...baseContent,
				text: "AS AN AI, I want to help",
			};
			const result = validateContent(content, "x");
			expect(result.valid).toBe(false);
		});

		test("should only report AI phrase once", () => {
			const content: GeneratedContent = {
				...baseContent,
				text: "As an AI and I'd be happy to help",
			};
			const result = validateContent(content, "x");
			const aiIssues = result.issues.filter((i) => i.includes("AI-sounding"));
			expect(aiIssues).toHaveLength(1);
		});
	});

	describe("validateContent - Hook length", () => {
		test("should accept short hook (under 25 words)", () => {
			const content: GeneratedContent = {
				...baseContent,
				text: "Short hook. Rest of content here.",
			};
			const result = validateContent(content, "x");
			// Should not have hook-length issue
			expect(result.issues.some((i) => i.includes("Hook"))).toBe(false);
		});

		test("should reject long hook (over 25 words)", () => {
			const content: GeneratedContent = {
				...baseContent,
				text: "This is a very long hook that contains way too many words and exceeds the recommended limit of twenty five words that should be in the first sentence.",
			};
			const result = validateContent(content, "x");
			expect(result.valid).toBe(false);
			expect(result.issues.some((i) => i.includes("Hook") && i.includes(">25"))).toBe(true);
		});

		test("should count hook words correctly", () => {
			const content: GeneratedContent = {
				...baseContent,
				text: "One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twenty-one twenty-two twenty-three twenty-four twenty-five twenty-six. Rest of content.",
			};
			const result = validateContent(content, "x");
			expect(result.valid).toBe(false);
			expect(result.issues.some((i) => i.includes("Hook"))).toBe(true);
		});

		test("should accept hook exactly at 25 words", () => {
			const words = Array.from({ length: 25 }, (_, i) => `word${i + 1}`).join(" ");
			const content: GeneratedContent = {
				...baseContent,
				text: `${words}. Rest of content.`,
			};
			const result = validateContent(content, "x");
			// Should not have hook-length issue
			const hookIssues = result.issues.filter((i) => i.includes("Hook"));
			expect(hookIssues.length).toBeLessThanOrEqual(0);
		});

		test("should handle different sentence terminators", () => {
			const content1: GeneratedContent = {
				...baseContent,
				text: "Short. Content",
			};
			const result1 = validateContent(content1, "x");
			expect(result1.issues.some((i) => i.includes("Hook"))).toBe(false);

			const content2: GeneratedContent = {
				...baseContent,
				text: "Short! Content",
			};
			const result2 = validateContent(content2, "x");
			expect(result2.issues.some((i) => i.includes("Hook"))).toBe(false);

			const content3: GeneratedContent = {
				...baseContent,
				text: "Short? Content",
			};
			const result3 = validateContent(content3, "x");
			expect(result3.issues.some((i) => i.includes("Hook"))).toBe(false);
		});
	});

	describe("validateContent - Hashtag count", () => {
		test("should accept up to 5 hashtags on X", () => {
			const content: GeneratedContent = {
				...baseContent,
				hashtags: ["tag1", "tag2", "tag3", "tag4", "tag5"],
			};
			const result = validateContent(content, "x");
			expect(result.issues.some((i) => i.includes("hashtag"))).toBe(false);
		});

		test("should reject 6 hashtags on X", () => {
			const content: GeneratedContent = {
				...baseContent,
				hashtags: ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6"],
			};
			const result = validateContent(content, "x");
			expect(result.valid).toBe(false);
			expect(result.issues.some((i) => i.includes("hashtag"))).toBe(true);
		});

		test("should allow many hashtags on Facebook", () => {
			const content: GeneratedContent = {
				...baseContent,
				hashtags: ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", "tag8"],
			};
			const result = validateContent(content, "facebook");
			expect(result.issues.some((i) => i.includes("hashtag"))).toBe(false);
		});

		test("should allow many hashtags on x_thread", () => {
			const content: GeneratedContent = {
				...baseContent,
				hashtags: ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6"],
			};
			const result = validateContent(content, "x_thread");
			expect(result.issues.some((i) => i.includes("hashtag"))).toBe(false);
		});
	});

	describe("validateContent - Multiple issues", () => {
		test("should report multiple issues", () => {
			const content: GeneratedContent = {
				text: "a".repeat(300),
				hashtags: ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6"],
				hook: "",
				cta: "",
			};
			const result = validateContent(content, "x");
			expect(result.valid).toBe(false);
			expect(result.issues.length).toBeGreaterThanOrEqual(2);
		});

		test("should report all issues without short-circuiting", () => {
			const content: GeneratedContent = {
				text: `# Header with **bold** and As an AI I'd be happy to help with ${"a".repeat(300)}`,
				hashtags: Array.from({ length: 10 }, (_, i) => `tag${i}`),
				hook: "",
				cta: "",
			};
			const result = validateContent(content, "x");
			expect(result.valid).toBe(false);
			// Should report: empty check, char limit, markdown, AI phrase, hashtag count
			expect(result.issues.length).toBeGreaterThan(2);
		});
	});

	describe("validateContent - Valid content", () => {
		test("should accept valid clean content", () => {
			const content: GeneratedContent = {
				text: "Excited to share this amazing update with you! Check it out.",
				hashtags: ["innovation", "tech"],
				hook: "Big news incoming",
				cta: "Learn more",
			};
			const result = validateContent(content, "x");
			expect(result.valid).toBe(true);
			expect(result.issues).toHaveLength(0);
		});

		test("should accept minimal valid content", () => {
			const content: GeneratedContent = {
				text: "New feature released",
				hashtags: [],
				hook: "",
				cta: "",
			};
			const result = validateContent(content, "x");
			expect(result.valid).toBe(true);
		});
	});
});
