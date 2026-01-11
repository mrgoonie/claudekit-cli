/**
 * Tests for opencode-path-transformer
 *
 * Verifies that .opencode/ path references are correctly transformed
 * to platform-appropriate global paths.
 */

import { describe, expect, it } from "bun:test";
import {
	IS_WINDOWS,
	OPENCODE_HOME_PREFIX,
	getOpenCodeGlobalPath,
	transformOpenCodeContent,
} from "@/services/transformers/opencode-path-transformer.js";

describe("opencode-path-transformer", () => {
	describe("platform detection", () => {
		it("IS_WINDOWS matches current platform", () => {
			const expected = process.platform === "win32";
			expect(IS_WINDOWS).toBe(expected);
		});

		it("OPENCODE_HOME_PREFIX is correct for platform", () => {
			if (IS_WINDOWS) {
				expect(OPENCODE_HOME_PREFIX).toBe("%APPDATA%");
			} else {
				expect(OPENCODE_HOME_PREFIX).toBe("$HOME/.config");
			}
		});
	});

	describe("getOpenCodeGlobalPath", () => {
		it("returns platform-appropriate path", () => {
			const path = getOpenCodeGlobalPath();
			if (IS_WINDOWS) {
				expect(path).toBe("%APPDATA%/opencode/");
			} else {
				expect(path).toBe("$HOME/.config/opencode/");
			}
		});

		it("path ends with trailing slash", () => {
			const path = getOpenCodeGlobalPath();
			expect(path.endsWith("/")).toBe(true);
		});

		it("path contains opencode directory", () => {
			const path = getOpenCodeGlobalPath();
			expect(path).toContain("opencode");
		});
	});

	describe("transformOpenCodeContent", () => {
		const globalPath = getOpenCodeGlobalPath();

		describe("pattern 1: ./.opencode/ relative paths", () => {
			it("transforms ./.opencode/ to global path", () => {
				const content = 'path: "./.opencode/config.json"';
				const { transformed, changes } = transformOpenCodeContent(content);
				expect(transformed).toContain(globalPath);
				expect(changes).toBeGreaterThan(0);
			});
		});

		describe("pattern 2: quoted paths", () => {
			it("transforms double-quoted .opencode/ paths", () => {
				const content = 'const dir = ".opencode/skills"';
				const { transformed, changes } = transformOpenCodeContent(content);
				expect(transformed).toBe(`const dir = "${globalPath}skills"`);
				expect(changes).toBe(1);
			});

			it("transforms single-quoted .opencode/ paths", () => {
				const content = "const dir = '.opencode/agents'";
				const { transformed, changes } = transformOpenCodeContent(content);
				expect(transformed).toBe(`const dir = '${globalPath}agents'`);
				expect(changes).toBe(1);
			});

			it("transforms backtick-quoted .opencode/ paths", () => {
				const content = "const dir = `.opencode/commands`";
				const { transformed, changes } = transformOpenCodeContent(content);
				expect(transformed).toBe(`const dir = \`${globalPath}commands\``);
				expect(changes).toBe(1);
			});
		});

		describe("pattern 3: parentheses (markdown links)", () => {
			it("transforms markdown link paths", () => {
				const content = "See [config](.opencode/config.md)";
				const { transformed, changes } = transformOpenCodeContent(content);
				expect(transformed).toBe(`See [config](${globalPath}config.md)`);
				expect(changes).toBe(1);
			});
		});

		describe("pattern 4: space-prefixed paths", () => {
			it("transforms space-prefixed paths", () => {
				const content = "directory: .opencode/agent";
				const { transformed, changes } = transformOpenCodeContent(content);
				expect(transformed).toContain(globalPath);
				expect(changes).toBe(1);
			});
		});

		describe("pattern 5: start of line", () => {
			it("transforms paths at start of line", () => {
				const content = ".opencode/command/test.md";
				const { transformed, changes } = transformOpenCodeContent(content);
				expect(transformed).toBe(`${globalPath}command/test.md`);
				expect(changes).toBe(1);
			});

			it("transforms paths at start of multiple lines", () => {
				const content = ".opencode/a\n.opencode/b";
				const { transformed, changes } = transformOpenCodeContent(content);
				expect(transformed).toBe(`${globalPath}a\n${globalPath}b`);
				expect(changes).toBe(2);
			});
		});

		describe("pattern 6: YAML/JSON colon paths", () => {
			it("transforms colon-space paths", () => {
				const content = "config: .opencode/opencode.json";
				const { transformed, changes } = transformOpenCodeContent(content);
				expect(transformed).toBe(`config: ${globalPath}opencode.json`);
				expect(changes).toBe(1);
			});

			it("transforms colon-no-space paths", () => {
				const content = "path:.opencode/file.txt";
				const { transformed, changes } = transformOpenCodeContent(content);
				expect(transformed).toBe(`path:${globalPath}file.txt`);
				expect(changes).toBe(1);
			});
		});

		describe("no changes scenarios", () => {
			it("returns zero changes for content without .opencode", () => {
				const content = "no opencode paths here";
				const { transformed, changes } = transformOpenCodeContent(content);
				expect(transformed).toBe(content);
				expect(changes).toBe(0);
			});

			it("returns zero changes for empty content", () => {
				const content = "";
				const { transformed, changes } = transformOpenCodeContent(content);
				expect(transformed).toBe("");
				expect(changes).toBe(0);
			});

			it("does not transform .opencode without trailing slash", () => {
				const content = "the .opencode directory";
				const { transformed, changes } = transformOpenCodeContent(content);
				expect(transformed).toBe(content);
				expect(changes).toBe(0);
			});
		});

		describe("multiple patterns", () => {
			it("handles multiple patterns in same content", () => {
				const content = `
        path1: ".opencode/a"
        path2: .opencode/b
      `;
				const { changes } = transformOpenCodeContent(content);
				expect(changes).toBe(2);
			});

			it("transforms all occurrences", () => {
				const content = 'Use ".opencode/config" and .opencode/settings and (.opencode/help)';
				const { transformed, changes } = transformOpenCodeContent(content);
				expect(changes).toBe(3);
				expect(
					transformed.match(new RegExp(globalPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"))
						?.length,
				).toBe(3);
			});
		});

		describe("real-world content examples", () => {
			it("transforms YAML config file content", () => {
				const content = `
opencode:
  config_dir: ".opencode/config"
  skills_dir: .opencode/skills
  agents_dir: ".opencode/agents"
`;
				const { transformed, changes } = transformOpenCodeContent(content);
				expect(changes).toBe(3);
				expect(transformed).toContain(globalPath);
			});

			it("transforms markdown documentation", () => {
				const content = `
## Configuration

Files are stored in \`.opencode/\` directory:
- Config: [opencode.json](.opencode/opencode.json)
- Skills: .opencode/skills/
`;
				const { changes } = transformOpenCodeContent(content);
				expect(changes).toBeGreaterThan(0);
			});
		});
	});
});
