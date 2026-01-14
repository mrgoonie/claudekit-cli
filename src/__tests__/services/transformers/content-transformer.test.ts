/**
 * Comprehensive Tests for content-transformer.ts
 *
 * Tests the transformation of slash command references when --prefix is applied.
 * Covers all edge cases users might encounter in real-world usage.
 */

import { describe, expect, it } from "bun:test";
import { transformCommandContent } from "@/services/transformers/commands-prefix/content-transformer.js";

describe("transformCommandContent", () => {
	// ============================================================================
	// SECTION 1: VALID TRANSFORMATIONS - Commands that SHOULD be transformed
	// ============================================================================

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

		it("transforms /test to /ck:test", () => {
			const input = "Run `/test` to verify";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe("Run `/ck:test` to verify");
			expect(changes).toBe(1);
		});

		it("transforms /preview to /ck:preview", () => {
			const input = "Use `/preview` to see changes";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe("Use `/ck:preview` to see changes");
			expect(changes).toBe(1);
		});

		it("transforms /kanban to /ck:kanban", () => {
			const input = "Open `/kanban` dashboard";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe("Open `/ck:kanban` dashboard");
			expect(changes).toBe(1);
		});

		it("transforms /journal to /ck:journal", () => {
			const input = "Write with `/journal`";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe("Write with `/ck:journal`");
			expect(changes).toBe(1);
		});

		it("transforms /debug to /ck:debug", () => {
			const input = "Use `/debug` for more info";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe("Use `/ck:debug` for more info");
			expect(changes).toBe(1);
		});

		it("transforms /watzup to /ck:watzup", () => {
			const input = "Check `/watzup` for changes";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe("Check `/ck:watzup` for changes");
			expect(changes).toBe(1);
		});

		it("transforms /integrate to /ck:integrate", () => {
			const input = "Run `/integrate` to connect";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe("Run `/ck:integrate` to connect");
			expect(changes).toBe(1);
		});

		it("transforms /bootstrap to /ck:bootstrap", () => {
			const input = "Use `/bootstrap` to initialize";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe("Use `/ck:bootstrap` to initialize");
			expect(changes).toBe(1);
		});

		it("transforms /worktree to /ck:worktree", () => {
			const input = "Create `/worktree` for feature";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe("Create `/ck:worktree` for feature");
			expect(changes).toBe(1);
		});

		it("transforms /scout to /ck:scout", () => {
			const input = "Use `/scout` to find files";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe("Use `/ck:scout` to find files");
			expect(changes).toBe(1);
		});
	});

	describe("position-based transformations", () => {
		it("transforms command at start of line", () => {
			const input = "/plan:fast is the command";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe("/ck:plan:fast is the command");
			expect(changes).toBe(1);
		});

		it("transforms command at end of line", () => {
			const input = "Use this command: /brainstorm";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe("Use this command: /ck:brainstorm");
			expect(changes).toBe(1);
		});

		it("transforms command after whitespace", () => {
			const input = "The planning process uses /plan:fast";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe("The planning process uses /ck:plan:fast");
			expect(changes).toBe(1);
		});

		it("transforms command after tab character", () => {
			const input = "Command:\t/plan:fast";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe("Command:\t/ck:plan:fast");
			expect(changes).toBe(1);
		});

		it("transforms command after newline", () => {
			const input = "Instructions:\n/plan:fast to start";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe("Instructions:\n/ck:plan:fast to start");
			expect(changes).toBe(1);
		});

		it("transforms command inside backticks", () => {
			const input = "Run `/plan:fast` command";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe("Run `/ck:plan:fast` command");
			expect(changes).toBe(1);
		});

		it("transforms command inside double backticks", () => {
			const input = "Run ``/plan:fast`` command";
			const { transformed } = transformCommandContent(input);
			expect(transformed).toContain("/ck:plan:fast");
		});

		it("transforms command that is only content", () => {
			const input = "/brainstorm";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe("/ck:brainstorm");
			expect(changes).toBe(1);
		});

		it("transforms command with subcommand that is only content", () => {
			const input = "/plan:fast";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe("/ck:plan:fast");
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

		it("transforms mixed commands with and without subcommands", () => {
			const input = "Run /brainstorm then /plan:fast then /kanban";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe("Run /ck:brainstorm then /ck:plan:fast then /ck:kanban");
			expect(changes).toBe(3);
		});

		it("transforms many commands in paragraph", () => {
			const input =
				"Start with /brainstorm to explore, then /plan:fast to create plan, /code:auto to implement, /fix:types for errors, and /review:codebase to verify";
			const { transformed, changes } = transformCommandContent(input);
			expect(changes).toBe(5);
			expect(transformed).toContain("/ck:brainstorm");
			expect(transformed).toContain("/ck:plan:fast");
			expect(transformed).toContain("/ck:code:auto");
			expect(transformed).toContain("/ck:fix:types");
			expect(transformed).toContain("/ck:review:codebase");
		});
	});

	describe("markdown context transformations", () => {
		it("transforms commands in markdown lists", () => {
			const input = `- /plan:fast for quick planning
- /plan:hard for thorough planning`;
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe(`- /ck:plan:fast for quick planning
- /ck:plan:hard for thorough planning`);
			expect(changes).toBe(2);
		});

		it("transforms commands in numbered lists", () => {
			const input = `1. /plan:fast
2. /code:auto
3. /fix:types`;
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe(`1. /ck:plan:fast
2. /ck:code:auto
3. /ck:fix:types`);
			expect(changes).toBe(3);
		});

		it("transforms commands in markdown headers", () => {
			const input = "## Using /plan:fast\n\nThis command...";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe("## Using /ck:plan:fast\n\nThis command...");
			expect(changes).toBe(1);
		});

		it("transforms commands in bold text", () => {
			const input = "**Important:** Use `/fix:hard` for complex issues";
			const { transformed } = transformCommandContent(input);
			expect(transformed).toBe("**Important:** Use `/ck:fix:hard` for complex issues");
		});

		it("transforms commands in italic text", () => {
			const input = "*Try `/brainstorm` first*";
			const { transformed } = transformCommandContent(input);
			expect(transformed).toBe("*Try `/ck:brainstorm` first*");
		});

		it("transforms commands after markdown link syntax", () => {
			const input = "[docs](link) then /plan:fast";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe("[docs](link) then /ck:plan:fast");
			expect(changes).toBe(1);
		});

		it("transforms commands in blockquotes", () => {
			const input = "> Use /plan:fast for quick results";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe("> Use /ck:plan:fast for quick results");
			expect(changes).toBe(1);
		});
	});

	describe("real-world markdown content examples", () => {
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

		it("transforms README workflow section", () => {
			const input = `## Quick Start

1. Run \`/brainstorm\` to explore ideas
2. Use \`/plan:fast\` for simple tasks or \`/plan:hard\` for complex ones
3. Execute \`/code:auto\` to implement
4. Fix issues with \`/fix:types\` or \`/fix:hard\`
5. Review with \`/review:codebase\``;

			const { transformed, changes } = transformCommandContent(input);
			expect(changes).toBe(7);
			expect(transformed).toContain("/ck:brainstorm");
			expect(transformed).toContain("/ck:plan:fast");
			expect(transformed).toContain("/ck:plan:hard");
			expect(transformed).toContain("/ck:code:auto");
			expect(transformed).toContain("/ck:fix:types");
			expect(transformed).toContain("/ck:fix:hard");
			expect(transformed).toContain("/ck:review:codebase");
		});

		it("transforms YAML command description", () => {
			const input = `commands:
  - name: /plan:fast
    description: Quick planning command`;

			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toContain("/ck:plan:fast");
			expect(changes).toBe(1);
		});
	});

	// ============================================================================
	// SECTION 2: FALSE POSITIVES - Content that should NOT be transformed
	// ============================================================================

	describe("file paths - should NOT transform", () => {
		it("does not transform relative file paths with ./", () => {
			const input = `with patch("builtins.input", side_effect=["3", "./test.db"]):`;
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe(input);
			expect(changes).toBe(0);
		});

		it("does not transform relative paths with ../", () => {
			const input = "Load from ../code/something or ../fix/here";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe(input);
			expect(changes).toBe(0);
		});

		it("does not transform absolute Unix paths", () => {
			const input = "File at /home/user/test or /var/log/debug";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe(input);
			expect(changes).toBe(0);
		});

		it("does not transform paths with extensions", () => {
			const input = "Open /path/to/code.ts or /data/test.json";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe(input);
			expect(changes).toBe(0);
		});

		it("does not transform Windows-style paths in strings", () => {
			const input = 'const path = "C:\\Users\\test\\code";';
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe(input);
			expect(changes).toBe(0);
		});

		it("does not transform node_modules paths", () => {
			const input = "import from /node_modules/test/index.js";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe(input);
			expect(changes).toBe(0);
		});
	});

	describe("HTML/XML tags - should NOT transform", () => {
		it("does not transform HTML closing tags", () => {
			const input = `<code class="font-mono">Code block</code>`;
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe(input);
			expect(changes).toBe(0);
		});

		it("does not transform self-closing tags", () => {
			const input = "<test/>";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe(input);
			expect(changes).toBe(0);
		});

		it("does not transform closing tags with attributes", () => {
			const input = '</div class="test">';
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe(input);
			expect(changes).toBe(0);
		});

		it("does not transform JSX closing tags", () => {
			const input = "return <Preview />;";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe(input);
			expect(changes).toBe(0);
		});

		// NOTE: SVG path data with space before command-like patterns WILL be transformed
		// This is a known limitation - `/code` after whitespace in SVG is indistinguishable
		// from valid documentation. This edge case is rare in practice.
		it("transforms SVG paths with space-preceded command patterns (known limitation)", () => {
			const input = '<path d="M10 10 /code 20 20" />';
			const { changes } = transformCommandContent(input);
			// This transforms because space precedes /code - acceptable trade-off
			expect(changes).toBe(1);
		});
	});

	describe("string literals - should NOT transform", () => {
		it("does not transform single-quoted string literals", () => {
			const input = `const backUrl = options.dashboardUrl || '/kanban';`;
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe(input);
			expect(changes).toBe(0);
		});

		it("does not transform double-quoted string literals", () => {
			const input = `const url = "/kanban";`;
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe(input);
			expect(changes).toBe(0);
		});

		it("does not transform template literal URL paths", () => {
			const input = "const urlPath = `/kanban?dir=${encodeURIComponent(plansDir)}`;";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe(input);
			expect(changes).toBe(0);
		});

		it("does not transform JSON string values", () => {
			const input = '{"route": "/kanban", "path": "/preview"}';
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe(input);
			expect(changes).toBe(0);
		});

		it("does not transform Python string literals", () => {
			const input = `redirect_url = '/kanban'`;
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe(input);
			expect(changes).toBe(0);
		});
	});

	describe("URL patterns - should NOT transform", () => {
		it("does not transform URLs containing command-like paths", () => {
			const input = "Visit https://example.com/plan:something";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe(input);
			expect(changes).toBe(0);
		});

		it("does not transform URL query parameters", () => {
			const input = "Navigate to /preview?id=123&mode=edit";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe(input);
			expect(changes).toBe(0);
		});

		it("does not transform API routes", () => {
			const input = "const route = '/api/kanban/tasks';";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe(input);
			expect(changes).toBe(0);
		});

		it("does not transform API versioned routes", () => {
			const input = "endpoint: /v1/test/results";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe(input);
			expect(changes).toBe(0);
		});

		it("does not transform URL fragments", () => {
			const input = "Link to page#/kanban section";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe(input);
			expect(changes).toBe(0);
		});

		it("does not transform localhost URLs", () => {
			const input = "http://localhost:3000/kanban";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe(input);
			expect(changes).toBe(0);
		});

		it("does not transform URL with port and path", () => {
			const input = "Server at http://127.0.0.1:8080/preview/index.html";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe(input);
			expect(changes).toBe(0);
		});
	});

	describe("already prefixed commands - should NOT transform", () => {
		it("does not transform already-prefixed commands", () => {
			const input = "Use `/ck:plan:fast` (already prefixed)";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe(input);
			expect(changes).toBe(0);
		});

		it("does not double-transform commands", () => {
			const input = "/ck:plan:fast";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe(input);
			expect(changes).toBe(0);
		});

		it("does not transform already-prefixed commands without subcommand", () => {
			const input = "Run `/ck:brainstorm` first";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe(input);
			expect(changes).toBe(0);
		});
	});

	describe("code patterns - should NOT transform", () => {
		it("does not transform partial matches in middle of words", () => {
			const input = "This is someplan:thing";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe(input);
			expect(changes).toBe(0);
		});

		it("does not transform regex patterns", () => {
			const input = "const regex = /test/g;";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe(input);
			expect(changes).toBe(0);
		});

		it("does not transform regex with flags", () => {
			const input = "pattern.match(/code/gi)";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe(input);
			expect(changes).toBe(0);
		});

		it("does not transform division operations", () => {
			const input = "result = total/plan";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe(input);
			expect(changes).toBe(0);
		});

		it("does not transform import paths", () => {
			const input = 'import { test } from "@/services/test";';
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe(input);
			expect(changes).toBe(0);
		});

		it("does not transform require paths", () => {
			const input = "const preview = require('./preview');";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe(input);
			expect(changes).toBe(0);
		});

		it("does not transform CSS selectors", () => {
			const input = ".container/preview { display: flex; }";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe(input);
			expect(changes).toBe(0);
		});

		it("does not transform object property access", () => {
			const input = "const val = obj.test/fix;";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe(input);
			expect(changes).toBe(0);
		});
	});

	describe("real-world code examples - should NOT transform", () => {
		it("does not transform Express route handlers", () => {
			const input = `app.get('/kanban', (req, res) => {
  res.render('kanban');
});`;
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe(input);
			expect(changes).toBe(0);
		});

		it("does not transform React Router paths", () => {
			const input = `<Route path="/preview" element={<Preview />} />`;
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe(input);
			expect(changes).toBe(0);
		});

		it("does not transform Next.js API routes", () => {
			const input = `// pages/api/test.ts
export default function handler(req, res) {}`;
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe(input);
			expect(changes).toBe(0);
		});

		it("does not transform fetch calls", () => {
			const input = `const response = await fetch('/api/kanban/tasks');`;
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe(input);
			expect(changes).toBe(0);
		});

		it("does not transform axios calls", () => {
			const input = `axios.get('/preview/data').then(res => console.log(res));`;
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe(input);
			expect(changes).toBe(0);
		});

		it("does not transform redirect calls", () => {
			const input = `router.push('/kanban');`;
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe(input);
			expect(changes).toBe(0);
		});

		it("does not transform navigation links", () => {
			const input = `<a href="/preview">Preview</a>`;
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe(input);
			expect(changes).toBe(0);
		});

		it("does not transform form action attributes", () => {
			const input = `<form action="/test/submit" method="POST">`;
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe(input);
			expect(changes).toBe(0);
		});

		it("does not transform Python mock patches", () => {
			const input = `with patch("builtins.input", side_effect=["3", "./test.db"]):`;
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe(input);
			expect(changes).toBe(0);
		});

		it("does not transform database paths", () => {
			const input = `const dbPath = './data/test.db';`;
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe(input);
			expect(changes).toBe(0);
		});
	});

	describe("HTTP server URL patterns - should NOT transform", () => {
		it("does not transform URL path assignments", () => {
			const input = `const backUrl = options.dashboardUrl || '/kanban';`;
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe(input);
			expect(changes).toBe(0);
		});

		it("does not transform template literal URLs", () => {
			const input = "const urlPath = `/kanban?dir=${encodeURIComponent(plansDir)}`;";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe(input);
			expect(changes).toBe(0);
		});

		it("does not transform URL building", () => {
			const input = `url = base + '/preview/' + id;`;
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe(input);
			expect(changes).toBe(0);
		});

		it("does not transform URL patterns in comments", () => {
			const input = "// Navigate to /kanban?filter=active";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe(input);
			expect(changes).toBe(0);
		});
	});

	// ============================================================================
	// SECTION 3: EDGE CASES AND BOUNDARY CONDITIONS
	// ============================================================================

	describe("boundary conditions", () => {
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

		it("handles content with only whitespace", () => {
			const input = "   \n\t\n   ";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe(input);
			expect(changes).toBe(0);
		});

		it("handles very long content with many commands", () => {
			const commands = Array(100).fill("/plan:fast").join(" ");
			const { changes } = transformCommandContent(commands);
			expect(changes).toBe(100);
		});

		it("handles unicode content around commands", () => {
			const input = "使用 `/plan:fast` 进行规划";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe("使用 `/ck:plan:fast` 进行规划");
			expect(changes).toBe(1);
		});

		it("handles emoji around commands", () => {
			const input = "🚀 Run /plan:fast 🎉";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe("🚀 Run /ck:plan:fast 🎉");
			expect(changes).toBe(1);
		});
	});

	describe("mixed content scenarios", () => {
		it("transforms only valid commands in mixed content", () => {
			const input = `Documentation: use /plan:fast here.
Code: const url = '/kanban';
More docs: try /brainstorm next.`;
			const { transformed, changes } = transformCommandContent(input);
			expect(changes).toBe(2);
			expect(transformed).toContain("/ck:plan:fast");
			expect(transformed).toContain("/ck:brainstorm");
			expect(transformed).toContain("'/kanban'"); // unchanged
		});

		it("handles markdown with embedded code blocks", () => {
			const input = `## Usage

Use \`/plan:fast\` to start.

\`\`\`javascript
const route = '/kanban';
\`\`\`

Then run /brainstorm for ideas.`;
			const { transformed, changes } = transformCommandContent(input);
			expect(changes).toBe(2);
			expect(transformed).toContain("/ck:plan:fast");
			expect(transformed).toContain("/ck:brainstorm");
			expect(transformed).toContain("'/kanban'"); // unchanged in code block
		});

		it("handles YAML with mixed command references", () => {
			const input = `name: workflow
commands:
  - /plan:fast
  - /code:auto
routes:
  dashboard: '/kanban'
  preview: '/preview'`;
			const { transformed, changes } = transformCommandContent(input);
			expect(changes).toBe(2);
			expect(transformed).toContain("/ck:plan:fast");
			expect(transformed).toContain("/ck:code:auto");
			expect(transformed).toContain("'/kanban'"); // unchanged
			expect(transformed).toContain("'/preview'"); // unchanged
		});
	});

	describe("special characters and escaping", () => {
		it("handles commands followed by special characters", () => {
			const input = "/brainstorm!";
			const { changes } = transformCommandContent(input);
			// Should not transform - ! is not a valid terminator
			expect(changes).toBe(0);
		});

		it("handles commands in parentheses", () => {
			const input = "(use /plan:fast)";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe("(use /ck:plan:fast)");
			expect(changes).toBe(1);
		});

		it("handles commands in square brackets", () => {
			const input = "[see /brainstorm]";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe("[see /ck:brainstorm]");
			expect(changes).toBe(1);
		});

		it("handles commands with trailing punctuation in markdown", () => {
			const input = "Run `/plan:fast`.";
			const { transformed, changes } = transformCommandContent(input);
			expect(transformed).toBe("Run `/ck:plan:fast`.");
			expect(changes).toBe(1);
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

		it("preserves line structure", () => {
			const input = `Line 1: /plan:fast
Line 2: /code:auto
Line 3: /fix:types`;
			const { transformed } = transformCommandContent(input);
			const lines = transformed.split("\n");
			expect(lines).toHaveLength(3);
			expect(lines[0]).toContain("/ck:plan:fast");
			expect(lines[1]).toContain("/ck:code:auto");
			expect(lines[2]).toContain("/ck:fix:types");
		});

		it("preserves indentation", () => {
			const input = `  - /plan:fast
    - /code:auto`;
			const { transformed } = transformCommandContent(input);
			expect(transformed).toBe(`  - /ck:plan:fast
    - /ck:code:auto`);
		});
	});
});
